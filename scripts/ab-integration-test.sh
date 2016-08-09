#!/bin/sh

set -x -e

export REDIS_URL=http://localhost:6379

redis() {
	! redis-cli $@ | grep ERR
}

clear_linkposts() {
	linkpost_keys=$(redis-cli keys 'linkpost:*')
	if [ "$linkpost_keys" != "" ]; then
		redis del $linkpost_keys
	fi
}

redis set ab:last_poll 1
clear_linkposts

node -e 'require("./build/controllers/abController").abController().then(() => process.exit(0), e => {console.log(e.stack || e); process.exit(1)})'

clear_linkposts
