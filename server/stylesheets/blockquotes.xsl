<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">
	<xsl:template match="blockquote">
		<blockquote>
			<xsl:apply-templates />
		</blockquote>
	</xsl:template>

	<xsl:template match="blockquote[@class='twitter-tweet']">
		<xsl:variable name="tweetHref" select="a[starts-with(@href, 'https://twitter.com/')][last()]/@href" />
		<xsl:variable name="tweetId">
			<xsl:call-template name="substring-after-last">
				<xsl:with-param name="value" select="$tweetHref" />
				<xsl:with-param name="separator" select="'/'" />
			</xsl:call-template>
		</xsl:variable>

		<figure class="op-social">
			<iframe>
				<html>
					<body>
						<script>window.twttr=function(a,b,c){var d,e=a.getElementsByTagName(b)[0],f=window.twttr||{};return a.getElementById(c)?f:(d=a.createElement(b),d.id=c,d.src="https://platform.twitter.com/widgets.js",e.parentNode.insertBefore(d,e),f._e=[],f.ready=function(a){f._e.push(a)},f)}(document,"script","twitter-wjs");</script>
					<xsl:apply-templates />
					</body>
				</html>
			</iframe>
		</figure>
	</xsl:template>

	<xsl:template name="substring-after-last">
		<xsl:param name="value" />
		<xsl:param name="separator" />
		<xsl:choose>
			<xsl:when test="contains($value, $separator)">
				<xsl:call-template name="substring-after-last">
					<xsl:with-param name="value" select="substring-after($value, $separator)" />
					<xsl:with-param name="separator" select="$separator" />
				</xsl:call-template>
			</xsl:when>
			<xsl:otherwise>
				<xsl:value-of select="$value" />
			</xsl:otherwise>
		</xsl:choose>
	</xsl:template>
</xsl:stylesheet>
