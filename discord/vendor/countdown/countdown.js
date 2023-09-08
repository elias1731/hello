// Countdown timer for redirecting to another URL after several redirectSec

var redirectSec = 7; // redirectSec for HTML
var foo; // variable for clearInterval() function

function redirect() {
    document.location.href = 'http://elias1731.de/discord/html/redirect_DnyFxYyCZq.html';
}

function updateSecs() {
    document.getElementById("redirectSec").innerHTML = redirectSec;
    redirectSec--;
    if (redirectSec == -1) {
        clearInterval(foo);
        redirect();
    }
}

function countdownTimer() {
    foo = setInterval(function () {
        updateSecs()
    }, 1000);
}

countdownTimer();