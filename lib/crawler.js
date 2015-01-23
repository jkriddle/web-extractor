var request = require('request'),
	fs = require('fs'),
	merge = require('merge'),
	Promise = require('bluebird'),
	cheerio = require('cheerio'),
	ExtractMatch = require('./extractmatch');

function Crawler(opts) {
	// defaults
	this.opts = {
		crawl : [],
		timeout : 3000
	};

	if (typeof opts == "string") {
		// Load from file
		this.opts = JSON.parse(fs.readFileSync(opts, 'utf8'));
	} else if (opts != undefined) {
		this.opts = merge(this.opts, opts);
	}

	// other attributes
	this._html = null;
	this._depth = 0;
	this._rootUrl = "";
};

/**
 * Retrieve HTML from the specified URL
 */
Crawler.prototype.download = function(url) {
	var _this = this;
	return new Promise(function(resolve, reject) {
		request({
			url : url,
			timeout: _this.opts.timeout
		}, function(err, resp, body) {
			if (!err && resp.statusCode == 200) {
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
			_this.crawl(_this.opts.start[i]).then(function() {
				complete++;
				checkComplete();
			}).catch(function(err) {
				complete++;
				checkComplete();
			});
		}
	});
}

Crawler.prototype.getAbsoluteUrl = function(url) {
	var _this = this;

	var isAbsolute = /^http/.test(url);
	
	// first query, set root path for this crawl
	if (isAbsolute && !_this._rootUrl) {
		var arr = url.split("/");
		_this._rootUrl = arr[0] + "//" + arr[2];
	}

	if (!isAbsolute) {
		url = _this._rootUrl + url;
	}

	return url;
}

/**
 * Recursive function to download a page, index it, find the URLs, and crawl them.
 */
Crawler.prototype.crawl = function(url) {
	var _this = this;

	url = _this.getAbsoluteUrl(url);

	var currentDepth = _this._depth;
	console.log("Crawling %s at a depth of %d", url, currentDepth);
	return new Promise(function(resolve, reject) {

		_this.download(url).then(function(resp) {
			if (currentDepth < _this.opts.maxDepth) {
				// craw URLs on this page
				var urls = _this.findUrls(resp);
				var complete = 0;
				_this._depth++;

				function checkComplete() {
					if (complete == urls.length) resolve();
				}

				if (urls.length == 0) {
					resolve();
					return;
				}

				for(var i = 0; i < urls.length; i++) {
					_this.crawl(urls[i]).then(function() {
						_this._depth--;
						complete++;
						checkComplete();
					}).catch(function(err) {
						//console.log(err);
						_this._depth--;
						complete++;
						checkComplete();
					});
				}
			} else {
				resolve();
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