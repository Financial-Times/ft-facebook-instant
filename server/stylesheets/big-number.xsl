<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">

	<xsl:template match="big-number">
		<aside>
			<h1>
				<xsl:apply-templates select="big-number-headline" />
			</h1>
			<xsl:apply-templates select="big-number-intro" />
		</aside>
	</xsl:template>

	<xsl:template match="big-number-headline">
		<xsl:apply-templates />
	</xsl:template>

	<xsl:template match="big-number-intro">
		<xsl:apply-templates />
	</xsl:template>

</xsl:stylesheet>
