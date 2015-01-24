var assert = require("assert"),
	fs = require("fs"),
	Extractor = require("../lib/extractor"),
	listHtml = fs.readFileSync('tests/data/chinese-food-list', 'utf8'),
	itemHtml = fs.readFileSync('tests/data/chinese-barbecue-sauce-128611', 'utf8'),
	scrapeHtml = fs.readFileSync('tests/data/sample-scrape-test-file', 'utf8'),
	util = require('util'),
	Crawler = Extractor.Crawler,
	ExtractMatch = Extractor.ExtractMatch;

describe('Crawler', function() {
	describe('#getCleanUrl()', function() {
		it('should return system path friendly format', function() {
			var crawler = new Crawler('tests/config/test.json');
			var result = crawler.getCleanUrl('http://localhost:8080/some-crazy-path?query=string');
			assert.equal(result, 'httplocalhost8080some-crazy-pathquerystring');
		});
	});

	describe('#scrape()', function() {
		it('should respond with JSON object of scraped data', function(done) {
			var crawler = new Crawler('tests/config/test.json');
			crawler.scrape('http://localhost:8181/tests/data/sample-scrape-test-file', scrapeHtml).then(function(obj) {
				assert.notEqual(obj, undefined);
				//console.log(util.inspect(obj, { showHidden : false, depth: 5}));
				if (obj != undefined && obj.recipe != undefined) {
					assert.equal(obj.recipe.title, "Chinese Barbecue Sauce");
				}
				done();
			}).catch(done);
		});
	});

	describe('#download()', function() {
		it('should respond with data from valid URL', function(done) {
			var crawler = new Crawler('tests/config/test.json');
			crawler.download('http://localhost:8181/data/chinese-food-list').then(function(html) {
				assert.notEqual(html.indexOf("<title>Chinese Food Recipes  - Food.com</title>"), -1);
				done();
			}).catch(done);
		});
	});

	describe('#findElements()', function() {
		it('should respond with a list of matching elements', function() {
			var crawler = new Crawler('tests/config/test.json');
			crawler.loadHtml(itemHtml);
			var elements = crawler.findElements("#rz-lead .item h1.fn");
			assert.equal(elements.html(), "Chinese Barbecue Sauce");
		});
	});

	describe('#findUrls()', function() {
		it('should respond with a list of matching URLs', function() {
			var crawler = new Crawler('tests/config/test.json');
			var urls = crawler.findUrls(listHtml)
			assert.equal(urls.length, 32);
		});
	});

	describe('#loadHtml()', function() {
		it('should parse and load HTML', function() {
			var crawler = new Crawler('tests/config/test.json');
			crawler.loadHtml(itemHtml);
			assert.notEqual(crawler._html, null);
		});
	});
});


describe('ExtractMatch', function() {
	describe('#init()', function() {
		it('should load all children based on config', function() {
			var config = JSON.parse(fs.readFileSync('tests/config/test.json', 'utf8'));
			var extractMatch = new ExtractMatch(config.extract[0]);
			assert.equal(extractMatch.getChildren().length, 6);
		});
	});

	describe('#getFullSpecifier()', function() {
		it('should retrieve full specifier based on parents', function() {
			var config = JSON.parse(fs.readFileSync('tests/config/test.json', 'utf8'));
			var extractMatch = new ExtractMatch(config.extract[0]);
			var child = extractMatch.getChildren()[0];
			assert.equal(child.getFullSpecifier(), "body #rz-lead .item h1.fn");
		});
	});
});
