# ft-facebook-instant
[![Circle CI](https://circleci.com/gh/Financial-Times/ft-facebook-instant/tree/master.svg?style=svg)](https://circleci.com/gh/Financial-Times/ft-facebook-instant/tree/master)

Facebook Instant Articles

## Development requirements

 - [fswatch 1.3](http://emcrisostomo.github.io/fswatch/) (`brew install fswatch`)
 - For local development, a local Redis server is beneficial. [Install Redis](http://redis.io/topics/quickstart) (probably `brew install redis`), run `redis-server`, then set `export REDIS_URL="redis://localhost:6379/"`, for example, in `./scripts/env.sh`.
