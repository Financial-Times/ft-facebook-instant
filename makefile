export SHELL := /bin/bash

HEROKU := $(shell command -v heroku 2> /dev/null)

ifdef HEROKU
	-include scripts/env.mk
endif

include vars.mk

all: babel

babel: $(LIB_FILES)

$(LIB)/%.js: tmp/$(SRC)/%.js
	@mkdir -p $(@D)
	@cp $< $@

tmp/$(SRC)/%.js: $(SRC)/%.js
	$(eval changed-files := $(shell make -f newer.mk | grep -v 'Nothing to be done'))
	$(if $(changed-files), $(BABEL) $(BABEL_OPTS) --out-dir tmp $(changed-files))

clean:
	rm -rf $(LIB)

lintspace: $(LINTSPACE_FILES)
	$(LINTSPACE) $(LINTSPACE_OPTS) $^

lint: $(SRC_FILES) $(TEST_FILES) $(TEST_UTILS)
	$(ESLINT) $(ESLINT_OPTS) $^

test: lint lintspace babel
	$(MOCHA) $(MOCHA_OPTS) test/**/*.js

ab-integration-test: lint lintspace babel $(INTEGRATION_DIRS) $(INTEGRATION_FILES)
	$(MOCHA) $(MOCHA_OPTS) integration/**/*.js

$(TEST)/stylesheets/%.js: $(SRC)/stylesheets/%.xsl
	@: # dummy target just to inform watch-make

# local config
scripts/env.sh:
	$(HEROKU_CONFIG_TO_ENV) $(HEROKU_CONFIG_OPTS) $(HEROKU_CONFIG_APP) $@

scripts/env.mk: scripts/env.sh
	sed 's/"//g ; s/=/:=/' < $< > $@

.PHONY: clean lint lintspace test
