/*
Author       : Dreamguys
Template Name: Dreamchat - Bootstrap Admin Template
Version      : 2.7.6
*/

(function ($) {
	"use strict";

	// Variables declarations
	var $wrapper = $('.main-wrapper');
	var $pageWrapper = $('.page-wrapper');
	var $slimScrolls = $('.slimscroll');

	// Sidebar

	var Sidemenu = function () {
		this.$menuItem = $('#sidebar-menu a');
	};

	function init() {
		var $this = Sidemenu;
		$('#sidebar-menu a').on('click', function (e) {
			if ($(this).parent().hasClass('submenu')) {
				e.preventDefault();
			}
			if (!$(this).hasClass('subdrop')) {
				$('ul', $(this).parents('ul:first')).slideUp(350);
				$('a', $(this).parents('ul:first')).removeClass('subdrop');
				$(this).next('ul').slideDown(350);
				$(this).addClass('subdrop');
			} else if ($(this).hasClass('subdrop')) {
				$(this).removeClass('subdrop');
				$(this).next('ul').slideUp(350);
			}
		});
		$('#sidebar-menu ul li.submenu a.active').parents('li:last').children('a:first').addClass('active').trigger('click');
	}

	// Sidebar Initiate
	init();

	// Mobile menu sidebar overlay

	$('body').append('<div class="sidebar-overlay"></div>');
	$(document).on('click', '#mobile_btn', function () {
		$wrapper.toggleClass('slide-nav');
		$('.sidebar-overlay').toggleClass('opened');
		$('html').addClass('menu-opened');
		return false;
	});

	// Sidebar Toggle Js
	$(".offcanvas-close,.offcanvas-overlay").on("click", function () {
		$(".offcanvas-info").removeClass("show");
		$(".offcanvas-overlay").removeClass("overlay-open");
	});
	$(".sidebar-menu").on("click", function () {
		$(".offcanvas-info").addClass("show");
		$(".offcanvas-overlay").addClass("overlay-open");
	});

	// Sticky Sidebar

	if ($(window).width() > 767) {
		if ($('.theiaStickySidebar').length > 0) {
			$('.theiaStickySidebar').theiaStickySidebar({
				// Settings
				additionalMarginTop: 125
			});
		}
	}


	


	$(document).ready(function () {
		document.getElementsByClassName("main-wrapper")[0].style.visibility = "visible";
	});

	// Sidebar overlay

	$(".sidebar-overlay").on("click", function () {
		$wrapper.removeClass('slide-nav');
		$(".sidebar-overlay").removeClass("opened");
		$('html').removeClass('menu-opened');
	});

	// Page Content Height

	if ($('.page-wrapper').length > 0) {
		var height = $(window).height();
		$(".page-wrapper").css("min-height", height);
	}

	// Page Content Height Resize

	$(window).resize(function () {
		if ($('.page-wrapper').length > 0) {
			var height = $(window).height();
			$(".page-wrapper").css("min-height", height);
		}
	});

		// Select 2	
		if ($('.select2').length > 0) {
			$(".select2").select2();
	   }
	   
	   if ($('.select').length > 0) {
		   $('.select').select2({
			   minimumResultsForSearch: -1,
			   width: '100%'
		   });
	   }

	// Custom Country Code Selector

	if ($('#phone').length > 0) {
		var input = document.querySelector("#phone");
		window.intlTelInput(input, {
			utilsScript: "assets/plugins/intltelinput/js/utils.js",
		});
	}

	// Select Box

	var selectAllItems = "#select-all";
	var checkboxItem = ":checkbox";
	$(selectAllItems).on('click', function() {

		if (this.checked) {
			$(checkboxItem).each(function () {
				this.checked = true;
			});
		} else {
			$(checkboxItem).each(function () {
				this.checked = false;
			});
		}

	});

	setTimeout(function(){
		$(".rating-select").on('click', function() {
			$(this).toggleClass("filled");
		});
	},100);

	// Datatable

	if ($('.datanew').length > 0) {
		$('.datanew').DataTable({
			"bFilter": true,
			"language": {
				search: ' ',
				searchPlaceholder: "Search...",
				paginate: {
					next: ' <i class="fas fa-chevron-right"></i>',
					previous: '<i class="fas fa-chevron-left"></i> '

				}
			},
			initComplete: (settings, json) => {
				$('.dataTables_filter').appendTo('#tableSearch');
				$('.dataTables_filter').appendTo('.search-input');
			},
			"columnDefs": [{
				"targets": 'no-sort',
				"orderable": false,
			}],
		});
	}

	if ($('.layout-blk').length > 0) {
		var table = '.table-ltr-rtl';

		$('.layout-blk ul li .layout-rtl').on('click', function () {
			$(table).addClass('table-direction');
			$(this).addClass('active');
			$('.layout-ltr').removeClass('active');
		});
		$('.layout-blk ul li .layout-ltr').on('click', function () {
			$(table).removeClass('table-direction');
			$(this).addClass('active');
			$('.layout-rtl').removeClass('active');
		});
	}


	// Datetimepicker

	if ($('.datetimepicker').length > 0) {
		$('.datetimepicker').datetimepicker({
			format: 'DD/MM/YYYY',
			icons: {
				up: "fa fa-angle-up",
				down: "fa fa-angle-down",
				next: 'fa fa-angle-right',
				previous: 'fa fa-angle-left'
			}
		});
		$('.datetimepicker').on('dp.show', function () {
			$(this).closest('.table-responsive').removeClass('table-responsive').addClass('temp');
		}).on('dp.hide', function () {
			$(this).closest('.temp').addClass('table-responsive').removeClass('temp')
		});
	}

	// Table Responsive

	setTimeout(function () {
		$(document).ready(function () {
			$('.table').parent().addClass('table-responsive');
		});
	}, 1000);


	// Date Range Picker
	if ($('input[name="datetimes"]').length > 0) {
		$('input[name="datetimes"]').daterangepicker({
			timePicker: true,
			startDate: moment().startOf('hour'),
			endDate: moment().startOf('hour').add(32, 'hour'),
			locale: {
				format: 'M/DD hh:mm A'
			}
		});
	}

	// Summernote

	if($('#summernote').length > 0) {
		$('#summernote').summernote({
		height: 300,                 // set editor height
		minHeight: null,             // set minimum height of editor
		maxHeight: null,             // set maximum height of editor
		focus: false                 // set focus to editable area after initializing summernote
		});
	}
	
	// Summernote

	if($('#summernote2').length > 0) {
		$('#summernote2').summernote({
		height: 300,                 // set editor height
		minHeight: null,             // set minimum height of editor
		maxHeight: null,             // set maximum height of editor
		focus: true                  // set focus to editable area after initializing summernote
		});
	}

	if($('#summernote3').length > 0) {
		$('#summernote3').summernote({
		placeholder: 'Type your message',
		height: 300,                 // set editor height
		minHeight: null,             // set minimum height of editor
		maxHeight: null,             // set maximum height of editor
		focus: true                  // set focus to editable area after initializing summernote
		});
	}
	if($('#summernote5').length > 0) {
		$('#summernote5').summernote({
		height: 300,                 // set editor height
		minHeight: null,             // set minimum height of editor
		maxHeight: null,             // set maximum height of editor
		focus: true                
		});
	}

	if($('.summernote').length > 0) {
		$('.summernote').summernote({
		minHeight: 100,           
		maxHeight: null,      
		focus: true,
		toolbar: [
			['fontsize', ['fontsize']],
			['font', ['bold', 'italic', 'underline', 'clear', 'strikethrough']],
			['insert', ['picture']]
		  ],          
		});
	}

	// Date Range Picker

	if ($('.bookingrange').length > 0) {
		var start = moment().subtract(6, 'days');
		var end = moment();

		function booking_range(start, end) {
			$('.bookingrange span').html(start.format('M/D/YYYY') + ' - ' + end.format('M/D/YYYY'));
		}

		$('.bookingrange').daterangepicker({
			startDate: start,
			endDate: end,
			ranges: {
				'Today': [moment(), moment()],
				'Yesterday': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
				'Last 7 Days': [moment().subtract(6, 'days'), moment()],
				'Last 30 Days': [moment().subtract(29, 'days'), moment()],
				'This Month': [moment().startOf('month'), moment().endOf('month')],
				'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
			}
		}, booking_range);

		booking_range(start, end);
	}

	// CounterUp

	if ($('.counter-up').length > 0) {
		$('.counter-up').counterUp({
			delay: 15,
			time: 1500
		});
	}

	// Counter 
	if($('.counter').length > 0) {
		$('.counter').counterUp({
			delay: 20,
			time: 2000
		});
	}
	if($('#timer-countdown').length > 0) {
		$( '#timer-countdown' ).countdown( {
			from: 180, // 3 minutes (3*60)
			to: 0, // stop at zero
			movingUnit: 1000, // 1000 for 1 second increment/decrements
			timerEnd: undefined,
			outputPattern: '$day Day $hour : $minute : $second',
			autostart: true
		});
	}
	
	if($('#timer-countup').length > 0) {
		$( '#timer-countup' ).countdown( {
			from: 0,
			to: 180 
		});
	}
	
	if($('#timer-countinbetween').length > 0) {
		$( '#timer-countinbetween' ).countdown( {
			from: 30,
			to: 20 
		});
	}
	
	if($('#timer-countercallback').length > 0) {
		$( '#timer-countercallback' ).countdown( {
			from: 10,
			to: 0,
			timerEnd: function() {
				this.css( { 'text-decoration':'line-through' } ).animate( { 'opacity':.5 }, 500 );
			} 
		});
	}
	
	if($('#timer-outputpattern').length > 0) {
		$( '#timer-outputpattern' ).countdown( {
			outputPattern: '$day Days $hour Hour $minute Min $second Sec..',
			from: 60 * 60 * 24 * 3
		});
	}

	
	//Password

	if ($('.toggle-password').length > 0) {
		$(document).on('click', '.toggle-password', function () {
			$(this).toggleClass("fa-solid fa-eye fa-solid fa-eye-slash");
			var input = $(".pass-input");
			if (input.attr("type") === "password") {
				input.attr("type", "text");
			} else {
				input.attr("type", "password");
			}
		});
	}

	//New-Password
	if ($('.toggle-passwords').length > 0) {
		$(document).on('click', '.toggle-passwords', function () {
			$(this).toggleClass("fa-solid fa-eye fa-solid fa-eye-slash");
			var input = $(".pass-inputs");
			if (input.attr("type") == "password") {
				input.attr("type", "text");
			} else {
				input.attr("type", "password");
			}
		});
	}

	//Confirm-Password
	if ($('.conform-toggle-password').length > 0) {
		$(document).on('click', '.conform-toggle-password', function () {
			$(this).toggleClass("fa-solid fa-eye fa-solid fa-eye-slash");
			var input = $(".conform-pass-input");
			if (input.attr("type") == "password") {
				input.attr("type", "text");
			} else {
				input.attr("type", "password");
			}
		});
	}

	//Theme Color

	$('.themecolorset').on('click', function () {
		$('.themecolorset').removeClass('active');
		$(this).addClass('active');
	});

	// Theme Image

	$('.theme-image').on('click', function () {
		$('.theme-image').removeClass('active');
		$(this).addClass('active');
	});

	// Tooltip

	if ($('[data-toggle="tooltip"]').length > 0) {
		$('[data-toggle="tooltip"]').tooltip();
	}

	// Datatable
	if($('.datatable').length > 0) {
		$('.datatable').DataTable({
			"bFilter": true, 
			"ordering": true,
			"info": true,
			"language": {
				search: ' ',
				sLengthMenu: 'Row Per Page _MENU_ Entries',
				searchPlaceholder: "Search",
				info: "Showing _START_ - _END_ of _TOTAL_ entries",
				paginate: {
					next: '<i class="ti ti-chevron-right"></i>',
					previous: '<i class="ti ti-chevron-left"></i> '
				},
			 }
		});
	}	

	// Check all email

	$(document).on('click', '#check_all', function () {
		$('.checkmail').click();
		return false;
	});
	if ($('.checkmail').length > 0) {
		$('.checkmail').each(function () {
			$(this).on('click', function () {
				if ($(this).closest('tr').hasClass('checked')) {
					$(this).closest('tr').removeClass('checked');
				} else {
					$(this).closest('tr').addClass('checked');
				}
			});
		});
	}

	// Mail important 

	$(document).on('click', '.mail-important', function () {
		$(this).find('i.fa').toggleClass('fa-star').toggleClass('fa-star-o');
	});


	// Summernote

	if ($('.summernote').length > 0) {
		$('.summernote').summernote({
			placeholder: 'Description',
			focus: true,
			minHeight: 100,
			disableResizeEditor: true
			// set focus to editable area after initializing summernote
		});
	}



	if ($('.main-wrapper').length > 0) {
		document.getElementsByClassName("main-wrapper")[0].style.visibility = "visible";
	}

	// Pages
	if ($('.table').length > 0) {
		setTimeout(function () {
			$(document).ready(function () {
				$('.table').parent().addClass('table-responsive');
			});
		}, 1000);
	}

	// Vector Map
	if ($('#vmap').length > 0) {
		$('#vmap').vectorMap({
			map: 'world_en',
			backgroundColor: '#333333',
			color: '#ffffff',
			hoverOpacity: 0.7,
			selectedColor: '#666666',
			enableZoom: true,
			showTooltip: true,
			scaleColors: ['#C8EEFF', '#006491'],
			normalizeFunction: 'polynomial'
		});
	}
	if ($('#vmap').length > 0) {
		$('#vmapusa').vectorMap({
			map: 'usa_en',
			enableZoom: true,
			showTooltip: true,
			selectedColor: null,
			hoverColor: null,
			colors: {
				mo: '#C9DFAF',
				fl: '#C9DFAF',
				or: '#C9DFAF'
			},
			onRegionClick: function (event, code, region) {
				event.preventDefault();
			}
		});
	}


	// Sidebar Slimscroll

	if ($slimScrolls.length > 0) {
		$slimScrolls.slimScroll({
			height: 'auto',
			width: '100%',
			position: 'right',
			size: '7px',
			color: '#ccc',
			allowPageScroll: false,
			wheelStep: 10,
			touchScrollStep: 100
		});
		var wHeight = $(window).height() - 60;
		$slimScrolls.height(wHeight);
		$('.sidebar .slimScrollDiv').height(wHeight);
		$(window).resize(function () {
			var rHeight = $(window).height() - 60;
			$slimScrolls.height(rHeight);
			$('.sidebar .slimScrollDiv').height(rHeight);
		});
	}
	// Small Sidebar

	$(document).on('click', '#toggle_btn', function () {
		if ($('body').hasClass('mini-sidebar')) {
			$('body').removeClass('mini-sidebar');
			$('.subdrop + ul').slideDown();
		} else {
			$('body').addClass('mini-sidebar');
			$('.subdrop + ul').slideUp();
		}
		return false;
	});
	$(document).on('mouseover', function (e) {
		e.stopPropagation();
		if ($('body').hasClass('mini-sidebar') && $('#toggle_btn').is(':visible')) {
			var targ = $(e.target).closest('.sidebar').length;
			if (targ) {
				$('body').addClass('expand-menu');
				$('.subdrop + ul').slideDown();
			} else {
				$('body').removeClass('expand-menu');
				$('.subdrop + ul').slideUp();
			}
			return false;
		}
	});

	//Advance Tabs

	$(".next").on('click', function () {
		const nextTabLinkEl = $(".nav-tabs .active")
			.closest("li")
			.next("li")
			.find("a")[0];
		const nextTab = new bootstrap.Tab(nextTabLinkEl);
		nextTab.show();
	});

	$(".previous").on('click', function () {
		const prevTabLinkEl = $(".nav-tabs .active")
			.closest("li")
			.prev("li")
			.find("a")[0];
		const prevTab = new bootstrap.Tab(prevTabLinkEl);
		prevTab.show();
	});

	if($('.custom-file-container').length > 0) {
		//First upload
		var firstUpload = new FileUploadWithPreview('myFirstImage')
		//Second upload
		var secondUpload = new FileUploadWithPreview('mySecondImage')
	}

	// Loader
	setTimeout(function () {
		$('#global-loader');
		setTimeout(function () {
			$("#global-loader").fadeOut("slow");
		}, 500);
	}, 500);

})(jQuery);

//Darkmode-Toggle
const toggleMode = (isDarkMode) => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('darkMode', isDarkMode ? 'enabled' : 'disabled');
    updateToggleButtons(isDarkMode);
};

// Clipboard 
if($('.clipboard').length > 0) {
	var clipboard = new ClipboardJS('.btn');
}

// toggle-password
if($('.toggle-password').length > 0) {
	$(document).on('click', '.toggle-password', function() {
		$(this).toggleClass("ti-eye ti-eye-off");
		var input = $(".pass-input");
		if (input.attr("type") == "password") {
			input.attr("type", "text");
		} else {
			input.attr("type", "password");
		}
	});
}
if($('.toggle-passwords').length > 0) {
	$(document).on('click', '.toggle-passwords', function() {
		$(this).toggleClass("ti-eye ti-eye-off");
		var input = $(".pass-input-2");
		if (input.attr("type") == "password") {
			input.attr("type", "text");
		} else {
			input.attr("type", "password");
		}
	});
}
if($('.toggle-passworda').length > 0) {
	$(document).on('click', '.toggle-passworda', function() {
		$(this).toggleClass("ti-eye ti-eye-off");
		var input = $(".pass-inputa");
		if (input.attr("type") == "password") {
			input.attr("type", "text");
		} else {setTimeout
			input.attr("type", "password");
		}
	});
}
$(function() {

	$(".circle-progress").each(function() {
  
	  var value = $(this).attr('data-value');
	  var left = $(this).find('.progress-left .progress-bar');
	  var right = $(this).find('.progress-right .progress-bar');
  
	  if (value > 0) {
		if (value <= 50) {
		  right.css('transform', 'rotate(' + percentageToDegrees(value) + 'deg)')
		} else {
		  right.css('transform', 'rotate(180deg)')
		  left.css('transform', 'rotate(' + percentageToDegrees(value - 50) + 'deg)')
		}
	  }
  
	})
  
	function percentageToDegrees(percentage) {
  
	  return percentage / 100 * 360
  
	}
  
});
