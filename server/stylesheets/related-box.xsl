<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:ext="http://exslt.org/common" exclude-result-prefixes="ext" version="1.0">

	<xsl:template match="//aside[contains(concat(' ',normalize-space(@class),' '),' n-content-related-box ')]">
		<ul class="op-related-articles" title="{//*[contains(concat(' ',normalize-space(@class),' '),' n-content-related-box__title-text ')]/text()}">
			<xsl:variable name="linkPass1">
				<a href="{*[contains(concat(' ',normalize-space(@class),' '),' n-content-related-box__headline ')]/a/@href}"></a>
			</xsl:variable>
			<li>
				<xsl:apply-templates select="ext:node-set($linkPass1)/*"></xsl:apply-templates>
			</li>
		</ul>
	</xsl:template>

</xsl:stylesheet>
