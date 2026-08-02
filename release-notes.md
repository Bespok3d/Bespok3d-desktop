# What's new in alpha 36

Bespok3d can tell us what gets used and what breaks, if you say it may.

## The app asks once, and no is the easy answer

On its first start Bespok3d asks whether it may send anonymous usage data. Until you answer, it sends nothing. Closing the question, pressing escape or clicking away all count as no, so the question is never left hanging over you and never comes back on its own. Settings, General holds the answer and a switch to change it whenever you like.

The question says what is sent and what is never sent on the screen you are looking at, not behind a link, and Settings shows you the same list.

## What is sent

That the app started, and a handful of things done with it: a printer enrolled, a plugin installed, the app updated. When something breaks, the kind of break and which part of the app it happened in. Your app version, the kind of app, the operating system it runs on and the language it is set to ride along with all of it.

That is the whole list. There is no screen counting, no click recording and no session replay, because there is no analytics library in the app to do any of it: Bespok3d writes each message itself, in one file, and sends nothing else.

## What is never sent

Nothing you type. Nothing about your printers: no serial numbers, no network addresses, no file names. Nothing about where you are: no country, no town, and the internet address your connection arrives on is never looked up and is never kept with what you send. No error text, only the kind of error.

There is no installation id. Every copy of Bespok3d reports under the same name, so the numbers can say how often something happens and can never say it was you. That is also why saying yes creates nothing and saying no has nothing to destroy.

It goes to a server Bespok3d runs, not to anybody else's.

## Turning it off stops it there

Turning the switch off stops anything further being sent, at once. It cannot take back what was already sent, and the app says so rather than implying otherwise.
