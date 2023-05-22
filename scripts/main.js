// @ts-nocheck

function toggleNav() {
    // Toggle the "is-active" class on both the "navbar-burger" and the "navbar-menu"
    $(".navbar-burger").toggleClass("is-active");
    $(".navbar-menu").toggleClass("is-active");
}

const elements = [];

$(document).ready(function() {

    // Check for click events on the navbar burger icon
    $(".navbar-burger").click(function() {
  
        toggleNav();
  
    });

    elements.push($("#features"));
    elements.push($("#testimonials"));
    elements.push($("#pricing"));
    elements.reverse();
    setActiveNav();

    $(window).on("scroll", () => setActiveNav());

});

function handleNav(elem) {
    $(".navbar-burger").removeClass("is-active");
    $(".navbar-menu").removeClass("is-active");
    
    $('html, body').animate({
        scrollTop: $(`#${$(elem).attr("data-target")}`).offset().top - $("#nav-main").outerHeight() + 5
    }, 2000);
}

function setActiveNav() {
    $(".navbar-item.is-active").toggleClass("is-active");

    const id = elements.find(e => {
        return window.scrollY > e.offset().top - window.outerHeight/3;
    })?.attr("id") ?? "home";
    $(`*[data-target=${id}]`).toggleClass("is-active");
}