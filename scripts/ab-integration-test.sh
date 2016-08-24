#!/bin/sh

set -x -e

export REDIS_URL=http://localhost:6379

redis() {
	local out=$(redis-cli $@)
	echo $out

	if echo $out | grep ERR; then
		exit 1
	fi
}

clear_linkposts() {
	linkpost_keys=$(redis keys 'linkpost:*')
	if [ "$linkpost_keys" != "" ]; then
		redis del $linkpost_keys
	fi
}

last_week=$(node -pe 'require("moment")().subtract(1, "week").unix()')

redis set ab:last_poll $last_week
clear_linkposts

node -e 'require("./build/controllers/abController").abController().then(() => process.exit(0), e => {console.log(e.stack || e); process.exit(1)})'

clear_linkposts
