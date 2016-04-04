## Why ?

This script provides an easy way to ping some URLS from a raw or sitemap file.

## Prerequisites

* [`nodejs`](https://nodejs.org/en/)

## Setup

```
$ git clone git@github.com:lcoq/sitemap-ping.git
$ cd sitemap-ping
$ npm install
```

## Usage

### Basic usage

```
$ npm run ping -- /path/to/file
$ npm run ping -- http://domain.com/path/to/file
```

```
$ npm run ping -- /path/to/sitemap.xml -s
$ npm run ping -- http://domain.com/path/to/sitemap.xml -s
```

```
$ npm run ping -- /path/to/zipped/sitemap.xml.gz -sg
$ npm run ping -- http://domain.com/path/to/zipped/sitemap.xml -sg
```


### Options

```
-r, --repeat <count>     Number of times URLs are pinged (default to 1)
-s, --sitemap            Parse file as a xml sitemap
-t, --timeout <seconds>  Seconds before request timeout (default to 5)
-g, --gzip               Decompress file with gzip
-h, --help               output usage information
-V, --version            output the version number
```

### Report

This script provides a report for each URL pinged:

```
http://www.google.com 200 (0.36s)
http://www.bing.com TIMEOUT
```

And a report once all URLs have been pinged:

```
--- Report ---
Success: 792
Timeout: 4
Error: 0
---
```
