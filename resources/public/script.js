/* global $, Handlebars */
/* exported unpublishArticle, publishArticle, localArticleAction, uploadArticle, loadTestArticle */

'use strict';

var uuidRegex = /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/;

function submitForm() {
	$('.js-uuid-error').text('');
	$('.article-status-container').html('');
	$('.js-uuid-group').removeClass('o-forms--error');
	if (!$('#uuid').val()) {
		return handleFormError('Please enter a UUID or article link to process');
	}
	var uuid = $('#uuid').val().match(uuidRegex);
	if (!uuid) {
		return handleFormError('Please enter a valid UUID or an article link containing a UUID');
	}
	if (window.location.pathname !== '/' + uuid[0]) {
		window.history.pushState({}, '', '/' + uuid[0]);
	}
	$('.js-uuid-submission-button').attr('disabled', 'disabled').text('Processing').addClass('activity');

	$.ajax({
		type: 'POST',
		url: '/' + uuid[0] + '/get',
		success: function(article) {
			restoreForm();
			$('.article-status-container').html(Handlebars.partials['article-status'](article));
			initialiseStatusCards();
		},
		error: function(jqXHR, status, error) {
			handleFormError('Server returned error: ' + jqXHR.responseText);
		}
	});
}

function handleFormError(error) {
	restoreForm();
	$('.js-uuid-error').html(error);
	$('.js-uuid-group').addClass('o-forms--error');
}

function restoreForm() {
	$('.js-uuid-submission-button').removeAttr('disabled').text('Process').removeClass('activity');
}

function initialiseStatusCards() {
	$('.status-card').each(function() {
		var feed = $(this).attr('data-feed');

		updateStatusCard(feed);
	});
}

function updateStatusCard(feed) {
	var card = $('.' + feed + '-status-card');
	var published = card.attr('data-published');
	var imported = card.attr('data-imported');

	if (imported) {
		updateStatusIcon(feed, 'import', 'fa-check-square-o');
	} else {
		updateStatusIcon(feed, 'import', 'fa-square-o');
	}

	if (published) {
		$('.feed-actions', card).html('<button class="o-techdocs-card__actionbutton" onclick="unpublishArticle(\'' + feed + '\');"><i class="fa fa-trash-o"></i> Remove from feed</button>');
		updateStatusIcon(feed, 'publish', 'fa-check-square-o');
	} else {
		$('.feed-actions', card).html('<button class="o-techdocs-card__actionbutton" onclick="publishArticle(\'' + feed + '\');"><i class="fa fa-arrow-circle-up"></i> Publish to feed</button>');
		updateStatusIcon(feed, 'publish', 'fa-square-o');
	}
}

function unpublishArticle(feed) {
	updateStatusIcon(feed, 'fa-spinner fa-spin');
	setButtonState(feed, false);
	$('.' + feed + '-publish-status-text').html('Removing, please wait...');

	$.ajax({
		type: 'POST',
		url: '/' + $('.article-status-card').attr('data-uuid') + '/unpublish',
		success: function(article) {
			$('.article-status-container').html(Handlebars.partials['article-status'](article));
			updateStatusCard(feed);
		},
		error: function(jqXHR, status, error) {
			updateStatusIcon(feed, 'fa-times');
			setButtonState(feed, true);
			$('.' + feed + '-publish-status-text').html('Server returned error: ' + jqXHR.responseText);
		}
	});

	return false;
}

function publishArticle(feed) {
	updateStatusIcon(feed, 'fa-spinner fa-spin');
	setButtonState(feed, false);
	$('.' + feed + '-publish-status-text').html('Publishing, please wait...');

	$.ajax({
		type: 'POST',
		url: '/' + $('.article-status-card').attr('data-uuid') + '/publish',
		success: function(article) {
			$('.article-status-container').html(Handlebars.partials['article-status'](article));
			updateStatusCard(feed);
		},
		error: function(jqXHR, status, error) {
			updateStatusIcon(feed, 'fa-times');
			setButtonState(feed, true);
			$('.' + feed + '-publish-status-text').html('Server returned error: ' + jqXHR.responseText);
		}
	});

	return false;
}

function localArticleAction(link, action) {
	if ($(link).attr('data-inprogress')) {
		return;
	}
	var originalContents = $(link).html();

	$(link).attr('data-inprogress', 1).html('<i class="fa fa-spinner fa-spin" /> Previewing...');

	$.ajax({
		type: 'POST',
		url: '/' + action + '/' + $('.article-status-card').attr('data-uuid'),
		success: function() {
			$(link).removeAttr('data-inprogress').html(originalContents);
		},
		error: function(jqXHR, status, error) {
			$(link).removeAttr('data-inprogress').html(originalContents);
			alert('Could not open preview: ' + jqXHR.responseText);
		}
	});
}

function loadTestArticle(uuid) {
	$('#uuid').val(uuid);
	submitForm();
}

function updateStatusIcon(feed, type, iconName) {
	$('.' + feed + '-' + type + '-status i').removeClass().addClass('fa ' + iconName);
}

function setButtonState(feed, enabled) {
	$('.' + feed + '-status-card .feed-actions button').each(function() {
		if (enabled) {
			$(this).removeAttr('disabled');
		} else {
			$(this).attr('disabled', 'disabled');
		}
	});
}
