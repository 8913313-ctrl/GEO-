<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:atom="http://www.w3.org/2005/Atom">
  <xsl:output method="html" encoding="UTF-8"/>
  <xsl:template match="/">
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title><xsl:value-of select="rss/channel/title"/></title>
        <style>
          *{box-sizing:border-box}body{margin:0;color:#151515;background:#fbfbfa;font-family:"Microsoft YaHei","PingFang SC",sans-serif}.shell{width:min(900px,calc(100% - 32px));margin:auto}header{padding:72px 0 52px;border-bottom:1px solid #e1e3e6}.mark{color:#315cff;font-size:12px;font-weight:800}h1{margin:14px 0 0;font-family:STSong,"Songti SC",serif;font-size:44px;line-height:1.2}header p{max-width:680px;color:#73777d;line-height:1.8}.back{display:inline-block;margin-top:22px;color:#315cff;font-weight:700;text-decoration:none}main{padding:40px 0 80px}.item{padding:30px 0;border-bottom:1px solid #e1e3e6}.meta{color:#315cff;font-size:12px}.item h2{margin:12px 0 0;font-size:25px;line-height:1.45}.item h2 a{color:inherit;text-decoration:none}.item h2 a:hover{color:#315cff}.item p{color:#73777d;line-height:1.8}@media(max-width:640px){header{padding-top:48px}h1{font-size:34px}.item h2{font-size:21px}}
        </style>
      </head>
      <body>
        <header><div class="shell"><div class="mark">TONGZHUO / CONTENT FEED</div><h1><xsl:value-of select="rss/channel/title"/></h1><p>这是供订阅工具、搜索引擎和AI系统读取的内容源。普通阅读请进入桐灼行业资讯页面。</p><a class="back" href="insights.html">进入行业资讯 →</a></div></header>
        <main class="shell"><xsl:for-each select="rss/channel/item"><article class="item"><div class="meta"><xsl:value-of select="category"/> · <xsl:value-of select="pubDate"/></div><h2><a><xsl:attribute name="href"><xsl:value-of select="link"/></xsl:attribute><xsl:value-of select="title"/></a></h2><p><xsl:value-of select="description"/></p></article></xsl:for-each></main>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
