# Coverage monitor

[![Status][ico-github-actions]][link-github]
[![Latest Version][ico-version]][link-github]
[![License][ico-license]][link-license]

<!-- [ico-github-actions]: https://github.com/gmsllc/coverage-monitor-action/workflows/build/badge.svg -->
<!-- [ico-version]: https://img.shields.io/github/tag/gmsllc/coverage-monitor-action.svg?label=latest -->
<!-- [ico-license]: https://img.shields.io/badge/License-MIT-blue.svg -->

[link-github]: https://github.com/gmsllc/coverage-monitor-action
[link-license]: LICENSE
[link-contributing]: .github/CONTRIBUTING.md

A GitHub Action that monitor coverage.
Forked of <https://github.com/slavcodev/coverage-monitor-action|slavcodev/coverage-monitor-action>

## Usage

### Pre-requisites

Create a workflow .yml file in your repositories .github/workflows directory.
The action works with `pull_request` event (check coverage and comment) and with `push` event (store coverage report in S3 for diff).

### Inputs

- `github-token` - The GITHUB_TOKEN secret.
- `clover-file` - Path to Clover XML file.
- `check` - Whether check the coverage thresholds.
- `comment` - Whether comment the coverage report.
- `threshold-alert` - Mark the build as unstable when coverage is less than this threshold.
- `threshold-warning` - Warning when coverage is less than this threshold.
- `status-context` - A string label to differentiate this status from the status of other systems.
- `comment-context` - A string label to differentiate the comment posted by this action.
- `comment-mode` - A mode for comments, supported: `replace`, `update` or `insert`.
- `base-clover-file` - Path to base Clover XML file. If specified then action won't try to download file from S3.
- `diff-tolerance` - Tolerance for coverage drop.
- `ignore-missing-base` - Do not throw an error if base coverage file is missing.
- `s3-bucket` - AWS S3 Bucket name.
- `s3-access-key-id` - AWS S3 Access Key Id.
- `s3-secret-access-key` - AWS S3 Secret Access Key.
- `s3-key-prefix` - S3 key prefix for coverage report storage inside bucket. Default: `coverage/${repository.full_name}`.

### Example workflow

~~~yaml
name: Tests
on: [pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v1

      - name: Test
        run: npm test

      - name: Monitor coverage
        uses: gmsllc/coverage-monitor-action@0.9.0
        with:
          github-token: ${{ github.token }}
          clover-file: coverage/clover.xml
          ignore-missing-base: true
          diff-tolerance: 0.01
          threshold-alert: 10
          threshold-warning: 50
          s3-bucket: my-bucket
          s3-access-key-id: ${{ secrets.S3_ACCESS_KEY }}
          s3-secret-access-key: ${{ secrets.S3_SECRET_KEY }}

~~~

## Demo

TBD

## Contributing

We would love for you to contribute, pull requests are welcome!
Please see the [CONTRIBUTING.md][link-contributing] for more information.


## License

[MIT License][link-license]
