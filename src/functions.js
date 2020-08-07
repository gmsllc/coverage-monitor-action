const xml2js = require('xml2js');
const fs = require('fs');

fs.readFileAsync = (filename) => new Promise(
  (resolve, reject) => {
    fs.readFile(filename, { encoding: 'utf-8' }, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(`${data}`.replace('\ufeff', ''));
      }
    });
  },
);

const parser = new xml2js.Parser(/* options */);

async function readFile(filename) {
  return parser.parseStringPromise(await fs.readFileAsync(filename));
}

function calcRate({ total, covered }) {
  return total
    ? Number((covered / total) * 100).toFixed(2) * 1
    : 0;
}

function calculateDiff(metric, baseMetric = {}, diffTolerance = 0) {
  const diff = {
    lines: 0,
    statements: 0,
    methods: 0,
    branches: 0,
    hasDropped: false
  };
  if (!baseMetric || !baseMetric.lines) {
    return diff;
  }
  diff.lines = Number(metric.lines.rate - baseMetric.lines.rate).toFixed(2);
  diff.statements = Number(metric.statements.rate - baseMetric.statements.rate).toFixed(2);
  diff.methods = Number(metric.methods.rate - baseMetric.methods.rate).toFixed(2);
  diff.branches = Number(metric.branches.rate - baseMetric.branches.rate).toFixed(2);
  diff.hasDropped = diff.lines + diffTolerance < 0
    || diff.statements + diffTolerance < 0
    || diff.methods + diffTolerance < 0
    || diff.branches + diffTolerance < 0;
  return diff;
}

function calculateLevel(metric, { thresholdAlert = 50, thresholdWarning = 90 } = {}) {
  const { rate: linesRate } = metric.lines;

  if(metric.diff && metric.diff.hasDropped) {
    return 'critical';
  }

  if (linesRate < thresholdAlert) {
    return 'red';
  }

  if (linesRate < thresholdWarning) {
    return 'yellow';
  }

  return 'green';
}

function readMetric(coverage, { thresholdAlert = 50, thresholdWarning = 90, baseMetric, diffTolerance = 0 } = {}) {
  const data = coverage.coverage.project[0].metrics[0].$;
  const metric = {
    statements: {
      total: data.elements * 1,
      covered: data.coveredelements * 1,
    },
    lines: {
      total: data.statements * 1,
      covered: data.coveredstatements * 1,
    },
    methods: {
      total: data.methods * 1,
      covered: data.coveredmethods * 1,
    },
    branches: {
      total: data.conditionals * 1,
      covered: data.coveredconditionals * 1,
    },
  };

  metric.statements.rate = calcRate(metric.statements);
  metric.lines.rate = calcRate(metric.lines);
  metric.methods.rate = calcRate(metric.methods);
  metric.branches.rate = calcRate(metric.branches);

  metric.diff = calculateDiff(metric, baseMetric, diffTolerance);
  metric.level = calculateLevel(metric, { thresholdAlert, thresholdWarning });

  return metric;
}

function generateBadgeUrl(metric) {
  return `https://img.shields.io/static/v1?label=coverage&message=${Math.round(metric.lines.rate)}%&color=${metric.level}`;
}

function generateEmoji(metric) {
  return metric.lines.rate === 100
    ? ' 🎉'
    : '';
}

function generateInfo({ rate, total, covered }) {
  return `${rate}% ( ${covered} / ${total} )`;
}

function generateCommentHeader({ commentContext }) {
  return `<!-- coverage-monitor-action: ${commentContext} -->`;
}

function generateTable({
  metric,
  commentContext,
}) {
  return `${generateCommentHeader({ commentContext })}
## ${commentContext}${generateEmoji(metric)}

|  Totals | ![Coverage](${generateBadgeUrl(metric)}) | Diff |
| :-- | -- | --: |
| Lines: | ${generateInfo(metric.lines)} | ${metric.diff.lines}% |
| Branches: | ${generateInfo(metric.branches)} | ${metric.diff.branches}% |
| Statements: | ${generateInfo(metric.statements)} | ${metric.diff.statements}% |
| Methods: | ${generateInfo(metric.methods)} | ${metric.diff.methods}% |
`;
}

function generateStatus({
  metric: { level, lines: { rate } },
  targetUrl,
  statusContext,
}) {
  if (level === 'critical') {
    return {
      state: 'failure',
      description: 'Critical: Coverage has dropped',
      target_url: targetUrl,
      context: statusContext,
    };
  }

  if (level === 'red') {
    return {
      state: 'failure',
      description: `Error: Too low coverage - ${rate}%`,
      target_url: targetUrl,
      context: statusContext,
    };
  }

  if (level === 'yellow') {
    return {
      state: 'success',
      description: `Warning: low coverage - ${rate}%`,
      target_url: targetUrl,
      context: statusContext,
    };
  }

  return {
    state: 'success',
    description: `Success: Coverage - ${rate}%`,
    target_url: targetUrl,
    context: statusContext,
  };
}

function toBool(value) {
  return typeof value === 'boolean'
    ? value
    : value === 'true';
}

function toInt(value) {
  return value * 1;
}

function loadConfig({ getInput }) {
  const comment = toBool(getInput('comment'));
  const check = toBool(getInput('check'));
  const githubToken = getInput('github_token', { required: true });
  const cloverFile = getInput('clover_file', { required: true });
  const baseCloverFile = getInput('base_clover_file');
  const diffTolerance = toInt(getInput('diff_tolerance') || 0);
  const thresholdAlert = toInt(getInput('threshold_alert') || 90);
  const thresholdWarning = toInt(getInput('threshold_warning') || 50);
  const statusContext = getInput('status_context') || 'Coverage Report';
  const commentContext = getInput('comment_context') || 'Coverage Report';
  let commentMode = getInput('comment_mode');

  if (!['replace', 'update', 'insert'].includes(commentMode)) {
    commentMode = 'replace';
  }

  return {
    comment,
    check,
    githubToken,
    cloverFile,
    baseCloverFile,
    diffTolerance,
    thresholdAlert,
    thresholdWarning,
    statusContext,
    commentContext,
    commentMode,
  };
}

module.exports = {
  readFile,
  readMetric,
  generateBadgeUrl,
  generateEmoji,
  generateTable,
  calculateDiff,
  calculateLevel,
  generateStatus,
  loadConfig,
  generateCommentHeader,
};
