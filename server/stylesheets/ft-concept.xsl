<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">

	<xsl:template match="ft-concept">
		<xsl:apply-templates select="child::node()" />
	</xsl:template>

</xsl:stylesheet>
