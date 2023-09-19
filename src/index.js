import { Upload } from '@aws-sdk/lib-storage';
import { GetObjectCommand, S3Client, S3 } from '@aws-sdk/client-s3';
import * as fs from 'fs';

const core = require('@actions/core');
const github = require('@actions/github');

const { backOff } = require('exponential-backoff');

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
  const destPath = 'baseClover.xml';
  const params = { Bucket: bucket, Key: key };
  const command = new GetObjectCommand(params);
  const response = await s3.send(command);
  const fileStream = fs.createWriteStream(destPath);
  response.Body.pipe(fileStream);
  return destPath;
}

async function s3Upload(s3, fileName, key, bucket) {
  const fileContent = fs.readFileSync(fileName);
  const params = { Bucket: bucket, Key: key, Body: fileContent };
  const upload = new Upload({
    client: s3,
    params,
  });
  await upload.done();
  console.log('S3 upload successful', { bucket, key });
}

async function run() {
  const config = loadConfig(core);
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
  } = config;

  console.log('Starting analysis', config);

  if (!check && !comment) {
    return;
  }

  const { context } = github;
  console.log(JSON.stringify(context, null, 2));
  const sha = context.payload.after;
  const prefix = s3KeyPrefix || `coverage/${context.payload.repository.full_name}`;
  const head = context.payload.pull_request && context.payload.pull_request.head.sha;
  const baseGitCommit = (context.payload.pull_request || { base: {} }).base.sha;
  const prNumber = (context.payload.pull_request || {}).number;
  const prUrl = (context.payload.pull_request || {}).html_url;

  const s3 = s3Bucket && s3AccessKeyId && s3SecretAccessKey
    ? (new S3({
      credentials: {
        accessKeyId: s3AccessKeyId,
        secretAccessKey: s3SecretAccessKey,
      },
      region: 'us-east-1',
    }) || new S3Client({
      credentials: {
        accessKeyId: s3AccessKeyId,
        secretAccessKey: s3SecretAccessKey,
      },
      region: 'us-east-1',
    }))
    : undefined;

  let baseCloverFileS3;
  if (s3) {
    if (sha) {
      await s3Upload(s3, cloverFile, `${prefix}/${sha}`, s3Bucket);
    }
    if (baseGitCommit && !baseCloverFile) {
      try {
        // retry with exponential backoff to wait for base branch builds being stored
        baseCloverFileS3 = await backOff(() => s3Download(s3, `${prefix}/${baseGitCommit}`, s3Bucket), {
          numOfAttempts: 3,
          startingDelay: 5000,
        });
      } catch (err) {
        if (!ignoreMissingBase) {
          throw err;
        }
        console.warn(`[ignored] Error downloading ${prefix}/${baseGitCommit} from ${s3Bucket}`, err);
      }
    } else {
      console.log('Skipped analysis', { baseGitCommit, baseCloverFile });
    }
  } else {
    console.log('S3 not configured', { s3Bucket, s3AccessKeyId, s3SecretAccessKey });
  }

  if (!github.context.payload.pull_request) {
    console.log('Not a pull request - exiting');
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
      sha: head,
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
  } else {
    console.log('Commenting not enabled');
  }
}

run().catch((error) => core.setFailed(error.message));
