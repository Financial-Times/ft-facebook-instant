# ft-facebook-instant
Facebook Instant Articles


### Database 'schema' ###
- *article:{uuid}*
	- Hash of article metadata: {uuid}, {title}, {date_editorially_published}, {date_updated}, {date_published_production}, {date_published_development}, {date_imported_production}, {date_imported_development}
- *published_{feed_type}*
	- Sorted set of *uuid*s scored by {date_published_{feed_type}}
- *imported_{feed_type}*
	- Sorted set of *uuid*s scored by {date_imported}
- *article:{uuid}:impressions:{feed_type}*
	- List of RSS feed impression timestamps (i.e. times seen by Facebook)
- *articles*
	- Sorted Set of known articles, scored by {date_updated}

### Database stories ###
- Add/update an article
	- *article.date_updated = now()*
	- *HMSET article:{uuid} key val key2 val2...*
	- *ZADD articles now() {uuid}*
- Given an article, get its details
	- hash of metadata, publish/import timestamps:
		- *HGETALL article:{uuid}*
	- publish state:
		- *ZSCORE published_{feed_type} {uuid}*
	- imported state:
		- *ZSCORE imported_{feed_type} {uuid}*
	- list of impressions:
		- *LRANGE article:{uuid}:impressions:{feed_type} 0 -1*
- Present a list of articles recently edited
	- get range of *articles* updated within x days:
		- *ZRANGEBYSCORE articles {x days ago} {now}*
		- foreach article, get:
			- hash of metadata, publish/import timestamps:
				- *HGETALL article:{uuid}*
			- publish state:
				- *ZSCORE published_{feed_type} {uuid}*
			- imported state:
				- *ZSCORE imported_{feed_type} {uuid}*
			- list of impressions:
				- *LRANGE article:{uuid}:impressions:{feed_type} 0 -1*
- Given an article, publish it in a feed
	- *HSET article:{uuid} {date_published_{feed_type}} now()*
	- *ZADD published_{feed_type} now() {uuid}*
- Given an article, re-publish it in a feed (e.g. following a CAPI notification that it was updated)
	- updated metadata as required
	- *HSET article:{uuid} {date_published_{feed_type}} now()*
	- *ZADD published_{feed_type} now() {uuid}*
	- *ZADD articles now() {uuid}*
- Given an article, remove it from a feed
	- *HDEL article:{uuid} {date_published_{feed_type}}*
	- *ZREM published_{feed_type} {uuid}*
- Construct a feed:
	- get list of articles which:
		- are published
		- have had fewer than 4 RSS impressions
		- were published within the past 24 hours
			- *ZRANGEBYSCORE published_{feed_type} {24 hours ago} {now}*
	- add each to feed
	- store impression timestamp:
		- *LPUSH article:{uuid}:impressions:{feed_type} now()*
	- If *(int) reply* is now 4:
		- *ZADD imported_{feed_type} now() {uuid}*
		- *ZREM published_{feed_type} {uuid}*
		- *HSET article:{uuid} {imported_{feed_type}} now()*
