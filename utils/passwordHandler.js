let crypto = require('crypto');

const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NUMBERS = '0123456789';
const SYMBOLS = '!@#$%^&*()-_=+?';
const ALL_CHARACTERS = LOWERCASE + UPPERCASE + NUMBERS + SYMBOLS;

function randomCharacter(characters) {
    return characters[crypto.randomInt(characters.length)];
}

function shuffle(characters) {
    let result = [...characters];
    for (let index = result.length - 1; index > 0; index--) {
        let randomIndex = crypto.randomInt(index + 1);
        [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
    }
    return result.join('');
}

module.exports = {
    generateStrongPassword: function (length = 16) {
        if (length < 4) {
            throw new Error('password length phai lon hon hoac bang 4');
        }

        let requiredCharacters = [
            randomCharacter(LOWERCASE),
            randomCharacter(UPPERCASE),
            randomCharacter(NUMBERS),
            randomCharacter(SYMBOLS)
        ];

        while (requiredCharacters.length < length) {
            requiredCharacters.push(randomCharacter(ALL_CHARACTERS));
        }

        return shuffle(requiredCharacters);
    }
}
