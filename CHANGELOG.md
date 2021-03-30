# Change Log
All notable changes to this project will be documented in this file
using the [Keep a CHANGELOG](http://keepachangelog.com/) principles.
This project adheres to [Semantic Versioning](http://semver.org/).

<!--
Types of changes

Added - for new features.
Changed - for changes in existing functionality.
Deprecated - for soon-to-be removed features.
Removed - for now removed features.
Fixed - for any bug fixes.
Security - in case of vulnerabilities.
-->

## [Unreleased]

_TBD_

## [0.9.2] 2021-03-30

- Changed number of S3 retry attempts and backoff time

## [0.9.1] 2020-09-07

### Fixed

- Fixed diff percentage being converted to string which made coverage decrease faulty

### Added

- Added exponential backoff retry to wait for base branch coverage reports being stored on S3

## [0.9.0] 2020-08-12

### Added

- Added base report diff
- Added S3 bucket storage for coverage history
