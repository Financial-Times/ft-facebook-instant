<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">

	<xsl:template match="//*[contains(concat(' ',normalize-space(@class),' '),' n-content-info-box ')]">
		<blockquote>
			<xsl:apply-templates select="//*[contains(concat(' ',normalize-space(@class),' '),' n-content-info-box__headline ')]" />
			<xsl:apply-templates select="*[contains(concat(' ',normalize-space(@class),' '),' n-content-info-box__content ')]/node()" />
		</blockquote>
	</xsl:template>

	<xsl:template match="//*[contains(concat(' ',normalize-space(@class),' '),' n-content-info-box__headline ')]">
		<strong><xsl:apply-templates /></strong>
	</xsl:template>

</xsl:stylesheet>
