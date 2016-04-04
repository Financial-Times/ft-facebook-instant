<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">

	<xsl:template match="//*[contains(concat(' ',normalize-space(@class),' '),' n-content-big-number ')]">
		<aside>
		<xsl:apply-templates select="*[contains(concat(' ',normalize-space(@class),' '),' n-content-big-number__title ')]/node()" />
			<cite>
			<xsl:apply-templates select="*[contains(concat(' ',normalize-space(@class),' '),' n-content-big-number__content ')]/node()" />
			</cite>
		</aside>
	</xsl:template>

</xsl:stylesheet>
