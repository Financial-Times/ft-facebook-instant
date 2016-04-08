/* global $, Handlebars */
/* exported runModeAction, loadTestArticle */

'use strict';

var updateFrequency = 1000;

function updateArticle(mode, action) {
	$.ajax({
		dataType: 'json',
		url: window.location.pathname + '/get',
		success: function(article) {
			updateStatus(article);
			checkStatus(article, mode);
		},
		error: function(jqXHR, status, error) {
			console.error(jqXHR.responseText);
			setTimeout(updateArticle.bind(null, mode, action), updateFrequency);
		}
	});
}

function checkStatus(article, mode, action) {
	var status;
	try {
		var record = article.fbRecords[mode];
		if (action === 'delete' && record.nullRecord) return;
		status = record.imports[0].status || record.most_recent_import_status.status;
	} catch (e) {}

	if (status !== 'SUCCESS' && status !== 'FAILED') {
		setTimeout(updateArticle.bind(null, mode, action), updateFrequency);
	}
}

function submitForm() {
	$('.js-url-error').text('');
	$('.article-status-container').html('');
	$('.js-url-group').removeClass('o-forms--error');
	$('.error-card').remove();

	var val = $('#url').val();
	if (!val) {
		return handleFormError('Please enter a UUID or article link to process');
	}

	var url = encodeURIComponent(val);
	if (window.location.pathname !== '/' + url) {
		window.history.pushState({}, '', '/article/' + url);
	}

	$('.js-url-submission-button').attr('disabled', 'disabled').text('Processing').addClass('activity');

	$.ajax({
		type: 'POST',
		dataType: 'json',
		url: '/article/' + url + '/get',
		success: function(article) {
			var url = encodeURIComponent(article.canonical);
			if (window.location.pathname !== '/' + url) {
				window.history.pushState({}, '', '/article/' + url);
			}

			restoreForm();
			updateStatus(article);
		},
		error: function(jqXHR, status, error) {
			handleFormError('Server returned error: ' + jqXHR.responseText);
		}
	});
}

function updateStatus(article) {
	$('.article-status-container').html(Handlebars.partials['article-status'](article));
}

function updateList(data) {
	$('.article-list').replaceWith(Handlebars.partials['article-list'](data));
}

function handleFormError(error) {
	restoreForm();
	$('.js-url-error').html(error);
	$('.js-url-group').addClass('o-forms--error');
}

function restoreForm() {
	$('.js-url-submission-button').removeAttr('disabled').text('Process').removeClass('activity');
}

function runModeAction(mode, action) {
	var iconSelector = '.' + mode + '-' + action + '-status i';
	var buttonSelector = '.' + mode + '-status-card .actions button';
	var canonical = $('.article-status-card').attr('data-canonical');

	updateStatusIcon(iconSelector, 'fa-spinner fa-spin');
	setButtonState(buttonSelector, false);
	$('.error-card').remove();

	$.ajax({
		type: 'POST',
		url: '/article/' + encodeURIComponent(canonical) + '/' + mode + '/' + action,
		success: function(article) {
			updateStatus(article);
			checkStatus(article, mode, action);
		},
		error: function(jqXHR, status, error) {
			updateStatusIcon(iconSelector, 'fa-times');
			setButtonState(buttonSelector, true);
			$('.' + mode + '-status-card').after(Handlebars.partials['error-card'](jqXHR.responseJSON));
		}
	});

	return false;
}

function runArticleAction(action) {
	var iconSelector = '.' + action + '-status i';
	var buttonSelector = '.article-status-card .actions button';
	var canonical = $('.article-status-card').attr('data-canonical');

	updateStatusIcon(iconSelector, 'fa-spinner fa-spin');
	setButtonState(buttonSelector, false);
	$('.error-card').remove();

	$.ajax({
		type: 'POST',
		url: '/article/' + encodeURIComponent(canonical) + '/' + action,
		success: function(article) {
			updateStatus(article);
		},
		error: function(jqXHR, status, error) {
			updateStatusIcon(iconSelector, 'fa-times');
			setButtonState(buttonSelector, true);
			$('.article-status-card').after(Handlebars.partials['error-card'](jqXHR.responseJSON));
		}
	});

	return false;
}

function loadTestArticle(url) {
	$('#url').val(url);
	submitForm();
}

function updateStatusIcon(selector, iconName) {
	$(selector).removeClass().addClass('fa ' + iconName);
}

function setButtonState(selector, enabled) {
	$(selector).each(function() {
		if (enabled) {
			$(this).removeAttr('disabled');
		} else {
			$(this).attr('disabled', 'disabled');
		}
	});
}

function getArticles() {
	return $.ajax({
		type: 'GET',
		url: '/',
		dataType: 'json'
	});
}

function republishAll() {
	var iconSelector = '.republish-status i';
	var buttonSelector = '.republish-status';

	updateStatusIcon(iconSelector, 'fa-spinner fa-spin');
	setButtonState(buttonSelector, false);
	$('.error-card').remove();

	$.ajax({
		type: 'POST',
		url: '/republish'
	}).then(
		getArticles
	).then(
		updateList,
		function(jqXHR, status, error) {
			updateStatusIcon(iconSelector, 'fa-times');
			setButtonState(buttonSelector, true);
			$('.article-list').before(Handlebars.partials['error-card'](jqXHR.responseJSON));
		}
	);

	return false;
}
