const path = require('path');
const parser = require('../src/functions');

describe('functions', () => {
  it('fails on invalid file', async () => {
    expect.hasAssertions();

    const filename = path.join(__dirname, 'unknown.xml');

    await expect(parser.readFile(filename)).rejects.toThrow('no such file or directory');
  });

  it('parses XML to JS', async () => {
    expect.hasAssertions();

    const filename = path.join(__dirname, '/clover.xml');
    const coverage = await parser.readFile(filename);

    expect(coverage).toHaveProperty('coverage');
    expect(coverage.coverage).toHaveProperty('project');
    expect(coverage.coverage.project).toHaveProperty('0');
    expect(coverage.coverage.project[0]).toHaveProperty('metrics');
    expect(coverage.coverage.project[0].metrics).toHaveProperty('0');

    const metric = parser.readMetric(coverage);

    ['statements', 'lines', 'methods', 'branches'].forEach((type) => {
      expect(metric).toHaveProperty(type);
      expect(metric[type]).toHaveProperty('total');
      expect(metric[type]).toHaveProperty('covered');
      expect(metric[type]).toHaveProperty('rate');
    });

    expect(metric.lines.rate).toStrictEqual(70.59); // 24 / 34
    expect(metric.statements.rate).toStrictEqual(68.18); // 45 / 66
    expect(metric.methods.rate).toStrictEqual(83.33); // 10 / 12
    expect(metric.branches.rate).toStrictEqual(55); // 11 / 20

    expect(metric).toHaveProperty('level');
    expect(metric.level).toStrictEqual('yellow'); // 79.59 < 90
  });

  it('calculates level', async () => {
    expect.hasAssertions();

    [
      [49, 50, 90, 'red'],
      [89, 50, 90, 'yellow'],
      [90, 50, 90, 'green'],
    ].forEach(
      ([linesRate, thresholdAlert, thresholdWarning, level]) => {
        const metric = { lines: { rate: linesRate } };
        const metricWithDiff = { lines: { rate: linesRate }, diff: { hasDropped: true } };
        const options = { thresholdAlert, thresholdWarning };
        expect(parser.calculateLevel(metric, options)).toStrictEqual(level);
        expect(parser.calculateLevel(metricWithDiff, options)).toStrictEqual('critical');
      },
    );
  });

  it('calculates diff', async () => {
    expect.hasAssertions();

    const metric = {
      lines: { rate: 10 }, statements: { rate: 51 }, branches: { rate: 48 }, methods: { rate: 33 },
    };
    const baseMetric = {
      lines: { rate: 11 }, statements: {}, branches: {}, methods: {},
    };
    expect(parser.calculateDiff(metric, baseMetric)).toMatchObject({
      lines: -1,
      hasDropped: true,
    });
  });

  it('generates status', async () => {
    expect.hasAssertions();
    const targetUrl = 'https://example.com';
    const statusContext = 'coverage';
    const rate = 50;

    expect(parser.generateStatus({
      targetUrl,
      statusContext,
      metric: { lines: { rate }, level: 'red' },
    })).toStrictEqual({
      state: 'failure',
      description: `Error: Too low coverage - ${rate}%`,
      target_url: targetUrl,
      context: statusContext,
    });

    expect(parser.generateStatus({
      targetUrl,
      statusContext,
      metric: { lines: { rate }, level: 'yellow' },
    })).toStrictEqual({
      state: 'success',
      description: `Warning: low coverage - ${rate}%`,
      target_url: targetUrl,
      context: statusContext,
    });

    expect(parser.generateStatus({
      targetUrl,
      statusContext,
      metric: { lines: { rate }, level: 'green' },
    })).toStrictEqual({
      state: 'success',
      description: `Success: Coverage - ${rate}%`,
      target_url: targetUrl,
      context: statusContext,
    });

    expect(parser.generateStatus({
      targetUrl,
      statusContext,
      metric: { lines: { rate }, level: 'critical' },
    })).toStrictEqual({
      state: 'failure',
      description: 'Critical: Coverage has dropped',
      target_url: targetUrl,
      context: statusContext,
    });
  });

  it('generates badge URL', async () => {
    expect.hasAssertions();

    const metric = {
      lines: { rate: 9.4 },
      level: 'green',
    };

    expect(parser.generateBadgeUrl(metric)).toStrictEqual('https://img.shields.io/static/v1?label=coverage&message=9%&color=green');
  });

  it('generates emoji', async () => {
    expect.hasAssertions();
    expect(parser.generateEmoji({ lines: { rate: 100 } })).toStrictEqual(' 🎉');
    expect(parser.generateEmoji({ lines: { rate: 99.99 } })).toStrictEqual('');
  });

  it('generates header', async () => {
    expect.hasAssertions();

    expect(parser.generateCommentHeader({ commentContext: 'foobar' })).toStrictEqual(`<!-- coverage-monitor-action: foobar -->`);
  });

  it('generates table', async () => {
    expect.hasAssertions();

    const metric = {
      statements: {
        total: 10,
        covered: 1,
        rate: 10,
      },
      lines: {
        total: 10,
        covered: 2,
        rate: 20,
      },
      methods: {
        total: 10,
        covered: 3,
        rate: 30,
      },
      branches: {
        total: 10,
        covered: 4,
        rate: 40,
      },
      level: 'yellow',
      diff: {
        statements: 1,
        lines: 2,
        methods: 3,
        branches: 4,
      },
    };

    const expectedString = `<!-- coverage-monitor-action: Coverage Report -->
## Coverage Report

|  Totals | ![Coverage](https://img.shields.io/static/v1?label=coverage&message=20%&color=yellow) | Diff |
| :-- | -- | --: |
| Lines: | 20% ( 2 / 10 ) | 2% |
| Branches: | 40% ( 4 / 10 ) | 4% |
| Statements: | 10% ( 1 / 10 ) | 1% |
| Methods: | 30% ( 3 / 10 ) | 3% |
`;

    expect(parser.generateTable({ metric, commentContext: 'Coverage Report' })).toStrictEqual(expectedString);
  });

  function createConfigReader(inputs) {
    return {
      getInput(name) {
        return inputs[
          name.split('-').reduce(
            (carry, item) => (carry === null ? item : `${carry}${item[0].toUpperCase() + item.slice(1)}`),
            null,
          )
        ];
      },
    };
  }

  it('loads config', async () => {
    expect.hasAssertions();

    const inputs = {
      comment: true,
      check: false,
      githubToken: '***',
      ignoreMissingBase: false,
      s3AccessKeyId: 'ACCESS KEY',
      s3Bucket: 'BUCKET',
      s3KeyPrefix: 'PREFIX',
      s3SecretAccessKey: 'SECRET',
      cloverFile: 'clover.xml',
      thresholdAlert: 10,
      thresholdWarning: 20,
      statusContext: 'Coverage',
      commentContext: 'Coverage Report',
      commentMode: 'replace',
      baseCloverFile: undefined,
      diffTolerance: 0,
    };

    const reader = createConfigReader(inputs);
    const config = parser.loadConfig(reader);

    expect(config).toStrictEqual(inputs);
  });

  it('use defaults on loading config', async () => {
    expect.hasAssertions();

    const inputs = {
      githubToken: '***',
      cloverFile: 'clover.xml',
    };

    const expected = {
      comment: false,
      check: false,
      githubToken: '***',
      ignoreMissingBase: false,
      s3AccessKeyId: undefined,
      s3Bucket: undefined,
      s3KeyPrefix: undefined,
      s3SecretAccessKey: undefined,
      cloverFile: 'clover.xml',
      thresholdAlert: 90,
      thresholdWarning: 50,
      statusContext: 'Coverage Report',
      commentContext: 'Coverage Report',
      commentMode: 'replace',
      baseCloverFile: undefined,
      diffTolerance: 0,
    };

    const reader = createConfigReader(inputs);
    const config = parser.loadConfig(reader);

    expect(config).toStrictEqual(expected);
  });

  it('coerces config values', async () => {
    expect.hasAssertions();

    const inputs = {
      comment: 'true',
      check: 'false',
      githubToken: '***',
      cloverFile: 'clover.xml',
      thresholdAlert: '10',
      thresholdWarning: '20',
      statusContext: 'Coverage',
      commentContext: 'Coverage Report',
      commentMode: 'replace',
      baseCloverFile: 'baseClover.xml',
      diffTolerance: 99,
    };

    const expected = {
      comment: true,
      check: false,
      githubToken: '***',
      ignoreMissingBase: false,
      s3AccessKeyId: undefined,
      s3Bucket: undefined,
      s3KeyPrefix: undefined,
      s3SecretAccessKey: undefined,
      cloverFile: 'clover.xml',
      thresholdAlert: 10,
      thresholdWarning: 20,
      statusContext: 'Coverage',
      commentContext: 'Coverage Report',
      commentMode: 'replace',
      baseCloverFile: 'baseClover.xml',
      diffTolerance: 99,
    };

    const reader = createConfigReader(inputs);
    const config = parser.loadConfig(reader);

    expect(config).toStrictEqual(expected);
  });

  it('use default comment mode if got unsupported value', async () => {
    expect.hasAssertions();

    const inputs = {
      githubToken: '***',
      cloverFile: 'clover.xml',
      commentMode: 'foo',
    };

    const expected = {
      comment: false,
      check: false,
      githubToken: '***',
      ignoreMissingBase: false,
      s3AccessKeyId: undefined,
      s3Bucket: undefined,
      s3KeyPrefix: undefined,
      s3SecretAccessKey: undefined,
      cloverFile: 'clover.xml',
      thresholdAlert: 90,
      thresholdWarning: 50,
      statusContext: 'Coverage Report',
      commentContext: 'Coverage Report',
      commentMode: 'replace',
      baseCloverFile: undefined,
      diffTolerance: 0,
    };

    const reader = createConfigReader(inputs);
    const config = parser.loadConfig(reader);

    expect(config).toStrictEqual(expected);
  });
});
