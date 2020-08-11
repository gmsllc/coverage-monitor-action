const core = require('@actions/core');
const github = require('@actions/github');
const AWS = require('aws-sdk');
const fs = require('fs');

const {
  readFile,
  readMetric,
  generateStatus,
  generateTable,
  loadConfig,
  generateCommentHeader,
} = require('./functions');
const {
  createCommitStatus,
  listComments,
  insertComment,
  upsertComment,
  replaceComment,
} = require('./github');

async function s3Download(s3, key, bucket) {
  return new Promise((resolve, reject) => {
    const destPath = 'baseClover.xml';
    const params = { Bucket: bucket, Key: key };
    const s3Stream = s3.getObject(params).createReadStream();
    const fileStream = fs.createWriteStream(destPath);
    s3Stream.on('error', reject);
    fileStream.on('error', reject);
    fileStream.on('close', () => { resolve(destPath); });
    s3Stream.pipe(fileStream);
  });
}

async function s3Upload(s3, fileName, key, bucket) {
  return new Promise((resolve, reject) => {
    const fileContent = fs.readFileSync(fileName);
    const params = { Bucket: bucket, Key: key, Body: fileContent };
    s3.upload(params, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

async function run() {
  const {
    comment,
    check,
    githubToken,
    cloverFile,
    baseCloverFile,
    ignoreMissingBase,
    diffTolerance,
    thresholdAlert,
    thresholdWarning,
    statusContext,
    commentContext,
    commentMode,
    s3Bucket,
    s3KeyPrefix,
    s3AccessKeyId,
    s3SecretAccessKey,
  } = loadConfig(core);

  if (!check && !comment) {
    return;
  }

  const { context } = github;
  const sha = context.payload.after;
  const prefix = s3KeyPrefix || `coverage/${context.payload.repository.full_name}`;
  const baseGitCommit = (context.payload.pull_request || { base: {} }).base.sha;
  const prNumber = (context.payload.pull_request || {}).number;
  const prUrl = (context.payload.pull_request || {}).html_url;

  const s3 = s3Bucket && s3AccessKeyId && s3SecretAccessKey
    ? new AWS.S3({
      accessKeyId: s3AccessKeyId,
      secretAccessKey: s3SecretAccessKey,
    })
    : undefined;

  let baseCloverFileS3;
  if (s3) {
    if (sha) {
      await s3Upload(s3, cloverFile, `${prefix}/${sha}`, s3Bucket);
    }
    if (baseGitCommit && !baseCloverFile) {
      try {
        baseCloverFileS3 = await s3Download(s3, `${prefix}/${baseGitCommit}`, s3Bucket);
      } catch (err) {
        if (!ignoreMissingBase) {
          throw err;
        }
        console.warn(`[ignored] Error downloading ${prefix}/${baseGitCommit} from ${s3Bucket}`, err);
      }
    }
  }

  if (!github.context.payload.pull_request) {
    return;
  }

  const client = github.getOctokit(githubToken);

  const coverage = await readFile(cloverFile);
  const baseCoverage = (baseCloverFileS3 || baseCloverFile)
    && await readFile(baseCloverFileS3 || baseCloverFile, ignoreMissingBase);
  const baseMetric = baseCoverage ? readMetric(baseCoverage) : undefined;
  const metric = readMetric(coverage, {
    thresholdAlert, thresholdWarning, baseMetric, diffTolerance,
  });

  if (check) {
    createCommitStatus({
      client,
      context,
      sha,
      status: generateStatus({ targetUrl: prUrl, metric, statusContext }),
    });
  }

  if (comment) {
    const message = generateTable({ metric, commentContext });

    switch (commentMode) {
      case 'insert':
        await insertComment({
          client,
          context,
          prNumber,
          body: message,
        });

        break;
      case 'update':
        await upsertComment({
          client,
          context,
          prNumber,
          body: message,
          existingComments: await listComments({
            client,
            context,
            prNumber,
            commentHeader: generateCommentHeader({ commentContext }),
          }),
        });

        break;
      case 'replace':
      default:
        await replaceComment({
          client,
          context,
          prNumber,
          body: message,
          existingComments: await listComments({
            client,
            context,
            prNumber,
            commentContext,
            commentHeader: generateCommentHeader({ commentContext }),
          }),
        });
    }
  }
}

run().catch((error) => core.setFailed(error.message));
