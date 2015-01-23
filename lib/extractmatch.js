function ExtractMatch(opts, parent) {
	this.opts = opts;
	this._parent = parent;
	this._children = [];

	// Load children
	if (this.opts.children) {
		for(var i = 0; i < this.opts.children.length; i++) {
			this._children.push(new ExtractMatch(this.opts.children[i], this));
		}
	}
}

/**
 * Retrieve child ExtractMatch elements
 */
ExtractMatch.prototype.getChildren = function() {
	return this._children;
}

/**
 * Retrieve parent ExtractMatch element
 */
ExtractMatch.prototype.getParent = function() {
	console.log(this._parent);
	return this._parent;
}

/**
 * Retrieve this element's specifier
 */
ExtractMatch.prototype.getMatch = function() {
	return this.opts.match;
}

/**
 * Retrieve full DOM path (jQuery specifier) to this element
 */
ExtractMatch.prototype.getFullSpecifier = function() {
	var match = "",
		parent = this.getParent();
	if (this.getParent()) match =  this.getParent().getFullSpecifier() + ' ';
	match += this.getMatch();
	return match;
}

module.exports = ExtractMatch;