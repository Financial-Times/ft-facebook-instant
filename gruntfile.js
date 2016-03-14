'use strict';

module.exports = function(grunt) {

	require('load-grunt-tasks')(grunt);

	grunt.initConfig({
		clean: {
			tasks: ['build'],
		},
		babel: {
			options: {
				sourceMap: false,
				presets: ['es2015'],
			},
			dist: {
				files: [{
					expand: true,
					cwd: './',
					src: ['server/**/*.js'],
					dest: 'build',
					rename: function(dest, src) {
						return dest + src.replace('server', '');
					},
				}],
			},
		},
		watch: {
			dist: {
				files: 'server/**/*.js',
				tasks: ['build'],
				options: {
					spawn: false,
				},
			},
		},
	});

	grunt.registerTask('default', ['build']);
	grunt.registerTask('build', function() {
		grunt.task.run([
			'clean',
			'babel:dist',
		]);
	});
};
