SRC = server
LIB = build
SRC_FILES = $(shell find $(SRC) -name '*.js')
LIB_FILES = $(patsubst $(SRC)/%.js, $(LIB)/%.js, $(SRC_FILES))

BABEL = node_modules/.bin/babel
BABEL_OPTS = --presets es2015

all: babel

babel: $(LIB_FILES)

$(LIB)/%.js: $(SRC)/%.js
	@mkdir -p $(@D)
	$(BABEL) $(BABEL_OPTS) $< -o $@

clean:
	rm -rf build

.PHONY: clean
