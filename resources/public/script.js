/* global $, Handlebars */
/* exported triggerImport, loadTestArticle */

'use strict';

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

function handleFormError(error) {
	restoreForm();
	$('.js-url-error').html(error);
	$('.js-url-group').addClass('o-forms--error');
}

function restoreForm() {
	$('.js-url-submission-button').removeAttr('disabled').text('Process').removeClass('activity');
}

function triggerImport(mode, publish) {
	updateStatusIcon(mode, 'fa-spinner fa-spin');
	setButtonState(mode, false);
	$('.error-card').remove();

	if (publish) {
		$('.' + mode + '-publish-status-text').html('Publishing, please wait...');
	} else {
		$('.' + mode + '-publish-status-text').html('Importing, please wait...');
	}

	$.ajax({
		type: 'POST',
		url: '/article/' + $('.article-status-card').attr('data-url') + '/' + mode + '/' + (publish ? 'publish' : 'import'),
		success: function(article) {
			updateStatus(article);
		},
		error: function(jqXHR, status, error) {
			updateStatusIcon(mode, 'fa-times');
			setButtonState(mode, true);
			$('.' + mode + '-publish-status-text').html(jqXHR.responseJSON.error);
			$('.' + mode + '-status-card').after(Handlebars.partials['error-card'](jqXHR.responseJSON));
		}
	});

	return false;
}

function loadTestArticle(url) {
	$('#url').val(url);
	submitForm();
}

function updateStatusIcon(mode, type, iconName) {
	$('.' + mode + '-' + type + '-status i').removeClass().addClass('fa ' + iconName);
}

function setButtonState(mode, enabled) {
	$('.' + mode + '-status-card .mode-actions button').each(function() {
		if (enabled) {
			$(this).removeAttr('disabled');
		} else {
			$(this).attr('disabled', 'disabled');
		}
	});
}
