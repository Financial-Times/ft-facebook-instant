SRC = server
LIB = build
TEST = test
INTEGRATION = integration
SRC_FILES = $(shell find $(SRC) -name '*.js')
LIB_FILES = $(patsubst $(SRC)/%.js, $(LIB)/%.js, $(SRC_FILES))
LIB_DIRS = $(dir $(LIB_FILES))
TEST_FILES = $(shell find $(TEST) -name '*.js')
TEST_DIRS = $(dir $(TEST_FILES))
TEST_UTILS = $(shell find test-utils -name '*.js')
INTEGRATION_FILES = $(shell find $(INTEGRATION) -name '*.js')
INTEGRATION_DIRS = $(dir $(INTEGRATION_FILES))

NPM_BIN := node_modules/.bin

BABEL = $(NPM_BIN)/babel
BABEL_OPTS =

ESLINT = $(NPM_BIN)/eslint
ESLINT_OPTS = --fix

LINTSPACE = $(NPM_BIN)/lintspaces
LINTSPACE_OPTS = -n -d tabs -l 2

MOCHA = $(NPM_BIN)/mocha
MOCHA_OPTS = --compilers js:babel-register --no-timeouts

HEROKU_CONFIG_TO_ENV = $(NPM_BIN)/heroku-config-to-env
HEROKU_CONFIG_OPTS = -i HEROKU_ -i REDIS_URL -i NODE_ENV -l REDIS_URL=redis://localhost:6379/ -l NODE_ENV=development
HEROKU_CONFIG_APP = ft-facebook-instant-staging
