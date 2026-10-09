//! Downloads a pinned set of files (one model revision) to disk, verified by SHA-256 while they
//! stream.
//!
//! This module has no Tauri types on purpose: the command in `mod.rs` is a thin wrapper, so the
//! hashing, resume, host and clean-up rules can be tested on their own against a local server.
//!
//! - Each file streams to `<root>/<revision>/<file>.partial`, hashed as it arrives.
//! - A partial left by a broken download resumes with `Range`. Only a `206` whose `Content-Range`
//!   starts where the partial ends is a resume; any other answer restarts the file from zero.
//! - A file is renamed into place only when its SHA-256 matches; otherwise the partial is deleted.
//! - Every URL, and every redirect it takes, must stay on the allowed hosts.
//! - Once every file of a revision is in place, the folders of other revisions are removed.

use reqwest::{header, redirect, Client, Response, StatusCode, Url};
use sha2::{Digest, Sha256};
use std::{
    fmt,
    fs::{self, File, OpenOptions},
    io::{self, Read, Write},
    path::{Path, PathBuf},
    time::Duration,
};

/// The hosts a GitHub release asset is served from: the release URL, then the 302 it answers with.
pub const RELEASE_HOSTS: &[&str] = &["github.com", "release-assets.githubusercontent.com"];

/// Free space a download needs before it starts: the model (278 MB) and tokenizer (17 MB), their
/// partials, and room to spare.
pub const REQUIRED_FREE_BYTES: u64 = 600 * 1024 * 1024;

const PARTIAL_SUFFIX: &str = ".partial";
const MAX_REDIRECTS: usize = 5;
const MAX_FILES: usize = 8;
const MAX_NAME_LEN: usize = 128;
/// Progress is reported at most once per this many bytes, and at the end of each file.
const PROGRESS_STEP_BYTES: u64 = 1024 * 1024;

/// Which URLs a download may touch.
#[derive(Clone, Copy, Debug)]
pub struct HostPolicy {
    pub hosts: &'static [&'static str],
    /// Production downloads are HTTPS on the default port only; tests serve plain HTTP locally.
    pub https_only: bool,
}

/// The policy the app uses: GitHub release assets over HTTPS.
pub const RELEASE_POLICY: HostPolicy = HostPolicy {
    hosts: RELEASE_HOSTS,
    https_only: true,
};

impl HostPolicy {
    pub fn allows(&self, url: &Url) -> bool {
        let scheme_ok = match url.scheme() {
            "https" => true,
            "http" => !self.https_only,
            _ => false,
        };
        let port_ok = !self.https_only || url.port().is_none();
        let host_ok = url.host_str().is_some_and(|host| {
            self.hosts
                .iter()
                .any(|allowed| allowed.eq_ignore_ascii_case(host))
        });
        scheme_ok && port_ok && host_ok && url.username().is_empty() && url.password().is_none()
    }
}

#[derive(Clone, Debug)]
pub struct FileRequest {
    pub name: String,
    pub url: String,
    /// Lowercase hex SHA-256 the file must hash to.
    pub sha256: String,
}

#[derive(Clone, Debug)]
pub struct RevisionRequest {
    pub revision: String,
    pub files: Vec<FileRequest>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Progress {
    pub file: String,
    pub received: u64,
    pub total: Option<u64>,
}

#[derive(Debug)]
pub enum DownloadError {
    /// The request itself is not allowed: a host, scheme, name or hash that does not fit.
    Refused(String),
    NoSpace {
        available: u64,
        required: u64,
    },
    Status(u16),
    Network(String),
    Integrity(String),
    Io(io::Error),
}

impl fmt::Display for DownloadError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Refused(reason) => write!(f, "refused: {reason}"),
            Self::NoSpace {
                available,
                required,
            } => write!(
                f,
                "not enough free space: {} MB free, {} MB needed",
                available / (1024 * 1024),
                required / (1024 * 1024)
            ),
            Self::Status(code) => write!(f, "the server answered HTTP {code}"),
            Self::Network(reason) => write!(f, "network error: {reason}"),
            Self::Integrity(file) => write!(f, "{file} does not match its pinned SHA-256"),
            Self::Io(error) => write!(f, "file error: {error}"),
        }
    }
}

impl std::error::Error for DownloadError {}

impl From<io::Error> for DownloadError {
    fn from(error: io::Error) -> Self {
        Self::Io(error)
    }
}

fn network_error(error: reqwest::Error) -> DownloadError {
    if error.is_redirect() {
        return DownloadError::Refused(format!("redirect not followed: {error}"));
    }
    DownloadError::Network(error.to_string())
}

/// A plain file or folder name: no separators, no `..`, nothing hidden, nothing to escape with.
pub fn is_plain_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= MAX_NAME_LEN
        && !name.starts_with('.')
        && !name.ends_with(PARTIAL_SUFFIX)
        && name
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
}

fn is_sha256_hex(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| matches!(byte, b'0'..=b'9' | b'a'..=b'f'))
}

/// Checks a request before anything touches the network or the disk. Returns the parsed URLs.
pub fn validate(request: &RevisionRequest, policy: HostPolicy) -> Result<Vec<Url>, DownloadError> {
    if !is_plain_name(&request.revision) {
        return Err(DownloadError::Refused(
            "the revision is not a plain name".into(),
        ));
    }
    if request.files.is_empty() || request.files.len() > MAX_FILES {
        return Err(DownloadError::Refused("a revision has 1 to 8 files".into()));
    }
    let mut urls = Vec::with_capacity(request.files.len());
    for (index, file) in request.files.iter().enumerate() {
        if !is_plain_name(&file.name) {
            return Err(DownloadError::Refused(format!(
                "{:?} is not a plain file name",
                file.name
            )));
        }
        if request.files[..index]
            .iter()
            .any(|other| other.name == file.name)
        {
            return Err(DownloadError::Refused(format!(
                "{} is listed twice",
                file.name
            )));
        }
        if !is_sha256_hex(&file.sha256) {
            return Err(DownloadError::Refused(format!(
                "{} has no valid SHA-256",
                file.name
            )));
        }
        let url = Url::parse(&file.url)
            .map_err(|_| DownloadError::Refused(format!("{} has no valid URL", file.name)))?;
        if !policy.allows(&url) {
            return Err(DownloadError::Refused(format!(
                "{} is not on an allowed host",
                url
            )));
        }
        urls.push(url);
    }
    Ok(urls)
}

/// A client that follows redirects only while they stay on the policy's hosts, with no overall
/// timeout (a 278 MB file can take a while) but a bound on connecting and on each read.
pub fn client(policy: HostPolicy) -> Result<Client, DownloadError> {
    Client::builder()
        .redirect(redirect::Policy::custom(move |attempt| {
            if attempt.previous().len() >= MAX_REDIRECTS {
                attempt.error("too many redirects")
            } else if policy.allows(attempt.url()) {
                attempt.follow()
            } else {
                let refused = format!("redirect to {} is not on an allowed host", attempt.url());
                attempt.error(refused)
            }
        }))
        .connect_timeout(Duration::from_secs(30))
        .read_timeout(Duration::from_secs(60))
        .build()
        .map_err(network_error)
}

/// Free space on the volume holding `path`.
pub fn available_space(path: &Path) -> io::Result<u64> {
    fs4::available_space(path)
}

fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

/// Feeds a file into `hasher`; returns how many bytes it read.
fn hash_into(path: &Path, hasher: &mut Sha256) -> io::Result<u64> {
    let mut file = File::open(path)?;
    let mut buffer = vec![0u8; 1024 * 1024];
    let mut total = 0u64;
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            return Ok(total);
        }
        hasher.update(&buffer[..read]);
        total += read as u64;
    }
}

pub fn sha256_file(path: &Path) -> io::Result<String> {
    let mut hasher = Sha256::new();
    hash_into(path, &mut hasher)?;
    Ok(to_hex(&hasher.finalize()))
}

/// The first byte of a `Content-Range: bytes <start>-<end>/<size>` answer.
fn content_range_start(response: &Response) -> Option<u64> {
    let value = response
        .headers()
        .get(header::CONTENT_RANGE)?
        .to_str()
        .ok()?;
    let range = value.trim().strip_prefix("bytes ")?;
    range.split('-').next()?.trim().parse().ok()
}

async fn get(
    client: &Client,
    url: &Url,
    policy: HostPolicy,
    from: u64,
) -> Result<Response, DownloadError> {
    let mut request = client.get(url.clone());
    if from > 0 {
        request = request.header(header::RANGE, format!("bytes={from}-"));
    }
    let response = request.send().await.map_err(network_error)?;
    // The redirect policy already checked every hop; this is the belt to its braces.
    if !policy.allows(response.url()) {
        return Err(DownloadError::Refused(format!(
            "{} is not on an allowed host",
            response.url()
        )));
    }
    Ok(response)
}

async fn download_file<F: FnMut(Progress)>(
    client: &Client,
    dir: &Path,
    file: &FileRequest,
    url: &Url,
    policy: HostPolicy,
    on_progress: &mut F,
) -> Result<(), DownloadError> {
    let target = dir.join(&file.name);
    let partial = dir.join(format!("{}{PARTIAL_SUFFIX}", file.name));

    let mut hasher = Sha256::new();
    let mut offset = if partial.is_file() {
        hash_into(&partial, &mut hasher)?
    } else {
        0
    };

    let mut response = get(client, url, policy, offset).await?;
    let resumed = offset > 0
        && response.status() == StatusCode::PARTIAL_CONTENT
        && content_range_start(&response) == Some(offset);
    if offset > 0 && !resumed {
        // Not a resume we can trust (a 200 with the whole file, a 416, a range that starts
        // elsewhere): start the file again. A 200 already carries the whole file.
        hasher = Sha256::new();
        offset = 0;
        if response.status() != StatusCode::OK {
            drop(response);
            response = get(client, url, policy, 0).await?;
        }
    }
    if !resumed && response.status() != StatusCode::OK {
        let _ = fs::remove_file(&partial);
        return Err(DownloadError::Status(response.status().as_u16()));
    }

    let mut out = if resumed {
        OpenOptions::new().append(true).open(&partial)?
    } else {
        File::create(&partial)?
    };
    let total = response.content_length().map(|length| length + offset);
    let mut received = offset;
    let mut reported = received;
    on_progress(Progress {
        file: file.name.clone(),
        received,
        total,
    });
    // On a network error the partial stays, so the next attempt resumes it.
    while let Some(chunk) = response.chunk().await.map_err(network_error)? {
        out.write_all(&chunk)?;
        hasher.update(&chunk);
        received += chunk.len() as u64;
        if received - reported >= PROGRESS_STEP_BYTES {
            reported = received;
            on_progress(Progress {
                file: file.name.clone(),
                received,
                total,
            });
        }
    }
    out.sync_all()?;
    drop(out);

    if to_hex(&hasher.finalize()) != file.sha256 {
        let _ = fs::remove_file(&partial);
        return Err(DownloadError::Integrity(file.name.clone()));
    }
    fs::rename(&partial, &target)?;
    on_progress(Progress {
        file: file.name.clone(),
        received,
        total: Some(received),
    });
    Ok(())
}

/// Removes every folder under `root` except `keep`. Files directly under `root` are left alone.
/// Best effort: a folder that cannot be removed now is tried again after the next download.
pub fn remove_other_revisions(root: &Path, keep: &str) -> io::Result<usize> {
    let mut removed = 0;
    for entry in fs::read_dir(root)? {
        let entry = entry?;
        if entry.file_name() == keep || !entry.file_type()?.is_dir() {
            continue;
        }
        if fs::remove_dir_all(entry.path()).is_ok() {
            removed += 1;
        }
    }
    Ok(removed)
}

/// Makes `<root>/<revision>/` hold every file of the request, each matching its SHA-256, then
/// removes the other revisions. Files already in place and matching are not downloaded again.
/// Returns the revision's folder.
pub async fn download_revision<F: FnMut(Progress)>(
    client: &Client,
    root: &Path,
    request: &RevisionRequest,
    policy: HostPolicy,
    free_space: impl Fn(&Path) -> io::Result<u64>,
    mut on_progress: F,
) -> Result<PathBuf, DownloadError> {
    let urls = validate(request, policy)?;
    let dir = root.join(&request.revision);
    fs::create_dir_all(&dir)?;

    let mut pending = Vec::new();
    for (file, url) in request.files.iter().zip(urls.iter()) {
        let target = dir.join(&file.name);
        if target.is_file() {
            if sha256_file(&target)? == file.sha256 {
                continue;
            }
            fs::remove_file(&target)?;
        }
        pending.push((file, url));
    }

    if !pending.is_empty() {
        let available = free_space(&dir)?;
        if available < REQUIRED_FREE_BYTES {
            return Err(DownloadError::NoSpace {
                available,
                required: REQUIRED_FREE_BYTES,
            });
        }
        for (file, url) in pending {
            download_file(client, &dir, file, url, policy, &mut on_progress).await?;
        }
    }

    remove_other_revisions(root, &request.revision)?;
    Ok(dir)
}
