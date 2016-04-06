<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">

	<xsl:template match="//*[contains(concat(' ',normalize-space(@class),' '),' n-content-image ')]">
		<figure data-feedback="fb:likes,fb:comments">
			<xsl:apply-templates select="img" mode="figure" />
			<xsl:apply-templates select="figcaption" mode="figcaption" />
		</figure>
	</xsl:template>

	<xsl:template match="img" mode="figure">
		<img src="{@src}" width="{@width}" height="{@height}" />
	</xsl:template>

	<xsl:template match="figcaption" mode="figcaption">
		<figcaption>
			<xsl:apply-templates select="node()" />
		</figcaption>
	</xsl:template>

</xsl:stylesheet>
