<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">

		<xsl:template match="pull-quote">
			<aside>
				<p><xsl:value-of select="pull-quote-text" /></p>
				<xsl:apply-templates select="pull-quote-source" />
				<xsl:apply-templates select="pull-quote-image" />
			</aside>
		</xsl:template>

		<xsl:template match="pull-quote-source">
			<xsl:if test="text()">
				<cite>
					<xsl:apply-templates select="text()" />
				</cite>
			</xsl:if>
		</xsl:template>

		<xsl:template match="pull-quote-image">
			<xsl:apply-templates select="current()/img" mode="aside-image-wrapper" />
		</xsl:template>

</xsl:stylesheet>
