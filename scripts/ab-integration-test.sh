#!/bin/sh

set -x -e

export REDIS_URL=http://localhost:6379

redis-cli set ab:last_poll 1
redis-cli keys 'linkpost:*' | xargs redis-cli del

node -e 'require("./build/controllers/abController").abController().then(() => process.exit(0), e => {console.log(e.stack); process.exit(1)})'

redis-cli keys 'linkpost:*' | xargs redis-cli del
