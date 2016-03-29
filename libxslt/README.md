## Dependencies

Requires the [libxslt](http://xmlsoft.org/libxslt/) C library - and more specifically its [processing tool](http://xmlsoft.org/XSLT/xsltproc2.html).

## XSLT

### Local install

If you're a Mac user you can install libxslt with [Homebrew](http://brew.sh/), just run `brew update && brew install libxslt`. If you're into Linux then the libxslt package is also available through Aptitude, Yum, RPM etc.

### Heroku

We include a precompiled binary for Heroku in this repo. Creating a new binary is relatively straightforward - download source, unpack, compile and pack up the result:

```sh
heroku run bash --app <app-name>
$ curl http://xmlsoft.org/sources/libxslt-1.1.28.tar.gz -o /tmp/libxslt.tar.gz
$ tar -C /tmp -xvf /tmp/libxslt.tar.gz
$ cd /tmp/libxslt-1.1.28
$ ./configure --prefix=/app/libxslt && make && make install
$ tar -cvzf /app/heroku-libxslt.tar.gz /app/libxslt/bin/
$ scp /app/heroku-libxslt.tar.gz send@the:file/somewhere
```

Only the `xsltproc` binary is required.
