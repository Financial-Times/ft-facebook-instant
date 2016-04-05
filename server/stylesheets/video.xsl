<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">

	<xsl:template match="//*[contains(concat(' ',normalize-space(@class),' '),' n-content-video--brightcove ')]">
		<xsl:variable name="videoId" select="substring-after(a/@href, 'http://video.ft.com/')" />
		<brightcove data-account="{$brightcoveAccountId}" data-player="{$brightcovePlayerId}" data-video-id="{$videoId}" />
	</xsl:template>

	<xsl:template match="p[a[contains(@href, 'youtube.com/watch') and string-length(text()) = 0]]">
		<xsl:apply-templates select="a" />
	</xsl:template>

	<xsl:template match="a[contains(@href, 'youtube.com/watch') and string-length(text()) = 0]">
		<xsl:variable name="videoId">
			<xsl:choose>
				<xsl:when test="contains(@href, '&amp;')">
					<xsl:value-of select="substring-before(substring-after(@href, 'v='), '&amp;')" />
				</xsl:when>
				<xsl:otherwise>
					<xsl:value-of select="substring-after(@href, 'v=')" />
				</xsl:otherwise>
			</xsl:choose>
		</xsl:variable>

		<amp-youtube
				data-videoid="{$videoId}"
				layout="responsive"
				width="480" height="270"></amp-youtube>
	</xsl:template>

</xsl:stylesheet>
