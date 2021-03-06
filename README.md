# Web Extractor
----

Crawl and scrape data from the web based on a ruleset you create.

## Installation

`npm install`

## Configuration

Create a json file with the rules you would like the extractor to follow. For examples see the /tests/json/ folder.

TODO: Document configuration properties

## Results

Results will be written to the /output folder.

## FAQ

**Q. My dataset has a bunch of duplicates!**

A: Check your configuration and make sure your classes/ids are not duplicates. For example sometimes you might have something like this:

```
<ol>
	<li class="ingredient">
		<span class="ingredient">
			<span class="amount">
				<span class="value">3</span>
				<span class="type"></span>
			</span> 
			<span class="name">minced garlic cloves</span>
		</span>
	</li>
	<li class="ingredient">
		<span class="ingredient">
			<span class="amount">
				<span class="value">1</span>
				<span class="type">large</span>
			</span> 
			<span class="name">onion</span>
		</span>
	</li>
	...
</ol>
```

If your config has a simple match of ".ingredient", you are going to have duplicate results due to the "li" element having a class of ingredient, AND the "span" class beneath it. In order to prevent the duplicate you must increase the specificity of your match to "li.ingredient", "span.ingredient", "li > .ingredient".
