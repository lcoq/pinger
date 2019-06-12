@lcoq/pinger
======

A small script for pinging URLs from a sitemap or one-url-by-line file.

```sh
$ pinger /path/to/file
$ pinger http://domain.com/path/to/file
$ pinger /path/to/unzipped/sitemap.xml -s
$ pinger http://domain.com/sitemap.xml.gz -sg
```

Table of Contents
-----------------

  * [Requirements](#requirements)
  * [Usage](#usage)
  * [Report](#report)
  * [Contributing](#contributing)
  * [License](#license)

Requirements
------------

pinger requires the following to run:

  * [Node.js][node]
  * [npm][npm] (normally comes with Node.js)

Usage
-----

pinger is easiest to use when installed with [npm][npm].

Install it globally so you'll have access to the `pinger` command anywhere on your system.

```sh
$ npm install -g @lcoq/pinger
```

Then you can run pinger with the following command:

### `pinger <file-path-or-url>`

pinger pings once each URLs in a file separated by a newline.

### `pinger <sitemap.xml.gz-path-or-url> -sg`

pinger pings once each URLs in the given `.xml.gz` sitemap file.

### Options

pinger supports the following options:

```
-s, --sitemap             Parse file as a .xml sitemap
-g, --gzip                Unzip .gz file
-t, --timeout <seconds>   Seconds before request timeout (default to 5)
-r, --repeat <count>      Number of times URLs are pinged (default to 1)
-b, --bunch <count>       Group requests by bunch of <count> requests and execute them simultaneously (default to 1)
-A, --agent               Specify the User-Agent string to send to the HTTP server
-h, --help                output usage information
-V, --version             output the version number
```

Report
------

pinger reports for each URL pinged the status code of the response and the time elapsed during the request-response cycle (including redirects).

When pinger is used with the `--timeout` option, each URL that ended in a request timeout is also reported:

```
http://www.google.com 200 (0.36s)
http://www.google.fr 200 (0.38s)
http://www.bing.com TIMEOUT
```

pinger also provides a report once all URLs are pinged:

```
--- Report ---
Success: 792
Timeout: 4
Error: 0
---
```

Contributing
------------

To contribute to pinger, please clone this repository locally, commit your code in a separate branch and open a pull-request.

License
-------

pinger is licensed under the [MIT][mit] license.

Copyright &copy; 2016, Louis Coquio


[node]: https://nodejs.org/
[npm]: https://www.npmjs.com/
[mit]: https://opensource.org/licenses/MIT
