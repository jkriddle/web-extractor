var request = require('request'),
	fs = require('fs'),
	path = require('path'),
	merge = require('merge'),
	Promise = require('bluebird'),
	cheerio = require('cheerio'),
	ExtractMatch = require('./extractmatch');

function Crawler(opts) {

	// defaults
	this.opts = {
		crawl : [],
		output : path.normalize(__dirname + '/../output'),
		timeout : 3000
	};

	if (typeof opts == "string") {
		// Load from file
		this.opts = merge(this.opts, JSON.parse(fs.readFileSync(opts, 'utf8')));
	} else if (opts != undefined) {
		this.opts = merge(this.opts, opts);
	}

	// other attributes
	this._html = null;
	this._indexed = [];

	console.log(this.opts.output);

	if (!fs.existsSync(path.normalize(this.opts.output))) {
		fs.mkdirSync(path.normalize(this.opts.output));
	}
};

Crawler.prototype.writeData = function(url, data) {
	var cleanUrl = url.replace(/[^a-zA-Z0-9 -]/g, '');
	fs.writeFileSync(path.normalize(this.opts.output + '/' + cleanUrl), data);
}

/**
 * Retrieve HTML from the specified URL
 */
Crawler.prototype.download = function(url) {
	var _this = this;
	_this._indexed.push(url);
	return new Promise(function(resolve, reject) {
		request({
			url : url,
			timeout: _this.opts.timeout
		}, function(err, resp, body) {
			if (!err && resp.statusCode == 200) {
				console.log("Content found for " + url);
				resolve(body);
			} else if (!err && resp.statusCode != 200) {
				reject("STATUS " + resp.statusCode + " for " + url);
			} else {
				reject(err);
			}
		});
	});
};

/**
 * Begin crawling based on the complete configuration file
 */
Crawler.prototype.start = function() {
	var _this = this;
	var complete = 0;
	return new Promise(function(resolve, reject) {
		function checkComplete() {
			if (complete == _this.opts.start.length) resolve();
		}
		for(var i = 0; i < _this.opts.start.length; i++) {
			var rootUrl = _this.getRootUrl(_this.opts.start[i]);
			_this.crawl(rootUrl, _this.opts.start[i], 0).then(function() {
				complete++;
				checkComplete();
			}).catch(function(err) {
				complete++;
				checkComplete();
			});
		}
	});
}

Crawler.prototype.hasIndexed = function(url) {
	var _this = this;
	if (_this._indexed.indexOf(url) != -1) return true;
	return false;
}

/**
 * Convert a URL into absolute format
 */
Crawler.prototype.getAbsoluteUrl = function(rootUrl, url) {
	var _this = this;

	var isAbsolute = _this.isAbsoluteUrl(url);

	if (!isAbsolute) {
		url = rootUrl + url;
	}

	return url;
}


/** 
 * Retrieve root URL path (i.e. http://foo.com/bar ==> http://foo.com)
 */
Crawler.prototype.isAbsoluteUrl = function(url) {
	return /^http/.test(url);s
}

/** 
 * Retrieve root URL path (i.e. http://foo.com/bar ==> http://foo.com)
 */
Crawler.prototype.getRootUrl = function(url) {
	var _this = this;
	var arr = url.split("/");
	var url = arr[0] + "//" + arr[2];
	return url;
}

/**
 * Recursive function to download a page, index it, find the URLs, and crawl them.
 */
Crawler.prototype.crawl = function(rootUrl, url, depth) {
	var _this = this;

	depth = depth || 0;

	var newRootUrl = rootUrl;

	// if URL is relative, use the root provided
	// otherwise set the new root for future crawls
	if (_this.isAbsoluteUrl(url)) {
		newRootUrl = _this.getRootUrl(url);
	}

	console.log("Crawling %s at a depth of %d", _this.getAbsoluteUrl(newRootUrl, url), depth);
	return new Promise(function(resolve, reject) {
		_this.download(_this.getAbsoluteUrl(newRootUrl, url)).then(function(resp) {
			_this.writeData(_this.getAbsoluteUrl(newRootUrl, url), resp);
			if (depth >= _this.opts.maxDepth) return resolve();

			// craw URLs on this page
			var urls = _this.findUrls(resp);
			var complete = 0;

			function checkComplete() {
				if (complete == urls.length) {
					resolve();
				}
			}

			if (urls.length == 0) {
				resolve();
				return;
			}

			for(var i = 0; i < urls.length; i++) {
				if (_this.hasIndexed(urls[i])) {
					complete++;
					continue;
				}
				_this._indexed.push(urls[i]);
				_this.crawl(newRootUrl, urls[i], depth + 1).then(function() {
					complete++;
					checkComplete();
				}).catch(function(err) {
					complete++;
					checkComplete();
				});
			}
			
		}).catch(function(err) {
			reject(err);
		})
	});
}

/**
 * Scrape HTML and find all matching elements using jQuery specifier
 */
Crawler.prototype.findElements = function(specifier) {
	return this._html.root().find(specifier);
};

/**
 * Scrape HTML and find all matching URLs
 */
Crawler.prototype.findUrls = function(html) {
	var matches = [];
	for(var i = 0; i < this.opts.crawl.length; i++) {
		var regexp = new RegExp(this.opts.crawl[i], 'gm');
		var m = html.match(regexp);
		if (m) matches = matches.concat(m);
	}

	// return unique items
	return matches.filter(function(item, pos) {
		return matches.indexOf(item) == pos;
	});
};

/**
 * Loads HTML content into crawler for parsing
 */
Crawler.prototype.loadHtml = function(html) {
	this._html = cheerio.load(html);
}

module.exports = Crawler;