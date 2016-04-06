<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">

	<xsl:template match="//*[contains(concat(' ',normalize-space(@class),' '),' n-content-video--brightcove ')]">
		<xsl:variable name="videoId" select="substring-after(a/@href, 'http://video.ft.com/')" />
		<brightcove data-account="{$brightcoveAccountId}" data-player="{$brightcovePlayerId}" data-video-id="{$videoId}" />
	</xsl:template>

	<xsl:template match="//*[contains(concat(' ',normalize-space(@class),' '),' n-content-video--youtube ')]">
		<xsl:variable name="videoId" select="substring-after(iframe/@src, 'https://www.youtube.com/embed/')" />
		<youtube data-video-id="{$videoId}" />
	</xsl:template>

</xsl:stylesheet>
