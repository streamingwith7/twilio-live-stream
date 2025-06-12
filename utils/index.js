const fs = require('fs');
const path = require('path');

exports.getLanguageCode = (languageName) => {
    const languageMap = {
        "english": "en-US",
        "spanish": "es-419",
        "portuguese": "pt-BR",
        "chinese": "zh",
        "japanese": "ja",
        "bulgarian": "bg",
        "romanian": "ro",
        "arabic": "ar",
        "czech": "cs",
        "finnish": "fi",
        "croatian": "hr",
        "french": "fr",
        "malay": "ms",
        "slovak": "sk",
        "danish": "da",
        "tamil": "ta",
        "ukrainian": "uk",
        "russian": "ru",
        "german": "de",
        "turkish": "tr",
        "polish": "pl",
        "italian": "it",
    };

    return languageMap[languageName.toLowerCase()];
}

exports.getLanguageFromCode = (languageCode) => {
    const languageMap = {
        "en-US": "english",
        "es-419": "spanish",
        "pt-BR": "portuguese",
        "zh": "chinese",
        "ja": "japanese",
        "bg": "bulgarian",
        "ro": "romanian",
        "ar": "arabic",
        "cs": "czech",
        "fi": "finnish",
        "hr": "croatian",
        "fr": "french",
        "ms": "malay",
        "sk": "slovak",
        "da": "danish",
        "ta": "tamil",
        "uk": "ukrainian",
        "ru": "russian",
        "de": "german",
        "tr": "turkish",
        "pl": "polish",
        "it": "italian",
    };
    return languageMap[languageCode];
}

exports.languageCodeToVoiceId = (language, gender, agentId = 0) => {
    /*{ title: "English Male", value: "c6kFzbpMaJ8UMD5P6l72" },
    { title: "Portuguese Male", value: "clZtB7OtxhK9OZwvfhJi" },
    { title: "Spanish Male", value: "Tuv6qBP1MF8VQUmS20Pu" },*/
    let voiceId = "";
    if (agentId == 71) { // for Robin Chan
        let voiceList = {
            "en-US": "pBZVCk298iJlHAcHQwLr",
            "en": "pBZVCk298iJlHAcHQwLr",
            "pt-BR": "pBZVCk298iJlHAcHQwLr",
            "es-419": "pBZVCk298iJlHAcHQwLr",
        }

        if (gender == "male") {
            voiceList = {
                "en-US": "FISo3sWdWP0bALUdgh5x",
                "en": "FISo3sWdWP0bALUdgh5x",
                "pt-BR": "JNI7HKGyqNaHqfihNoCi",
                "es-419": "Tuv6qBP1MF8VQUmS20Pu",
            }
        }
        voiceId = voiceList[language] || "FISo3sWdWP0bALUdgh5x";
    } else if (agentId == 76) { // for Alejandra
        let voiceList = {
            "en-US": "HAgzwFYkaEpyLi6IC4Cp",
            "en": "HAgzwFYkaEpyLi6IC4Cp",
            "pt-BR": "HAgzwFYkaEpyLi6IC4Cp",
            "es-419": "CaJslL1xziwefCeTNzHv",
        }

        if (gender == "male") {
            voiceList = {
                "en-US": "FISo3sWdWP0bALUdgh5x",
                "en": "FISo3sWdWP0bALUdgh5x",
                "pt-BR": "JNI7HKGyqNaHqfihNoCi",
                "es-419": "Tuv6qBP1MF8VQUmS20Pu",
            }
        }
        voiceId = voiceList[language] || "HAgzwFYkaEpyLi6IC4Cp";
    } else if (agentId == 77) { // for Rizzetti Real Estate Luxury Living
        let voiceList = {
            "en-US": "HAgzwFYkaEpyLi6IC4Cp",
            "en": "HAgzwFYkaEpyLi6IC4Cp",
            "pt-BR": "HAgzwFYkaEpyLi6IC4Cp",
            "es-419": "CaJslL1xziwefCeTNzHv",
            "it": "7P3Dy5y3re9VTOAgKr6U"
        }

        if (gender == "male") {
            voiceList = {
                "en-US": "FISo3sWdWP0bALUdgh5x",
                "en": "FISo3sWdWP0bALUdgh5x",
                "pt-BR": "JNI7HKGyqNaHqfihNoCi",
                "es-419": "Tuv6qBP1MF8VQUmS20Pu",
                "it": "7P3Dy5y3re9VTOAgKr6U"
            }
        }
        voiceId = voiceList[language] || "HAgzwFYkaEpyLi6IC4Cp";
    } else {

        let voiceList = {
            "en": "kPzsL2i3teMYv0FxEYQ6",
            "en-US": "kPzsL2i3teMYv0FxEYQ6",
            "pt-BR": "QJd9SLe6MVCdF6DR0EAu",
            "es-419": "CaJslL1xziwefCeTNzHv",
        };

        if (gender == "male") {
            voiceList = {
                "en-US": "FISo3sWdWP0bALUdgh5x",
                "en": "FISo3sWdWP0bALUdgh5x",
                "pt-BR": "JNI7HKGyqNaHqfihNoCi",
                "es-419": "Tuv6qBP1MF8VQUmS20Pu",
            }
        }

        voiceId = voiceList[language] || "kPzsL2i3teMYv0FxEYQ6";
    }
    console.log(`voiceId: ${voiceId}`.blue);
    return voiceId;
}

class Logger {
    constructor(logFilePath = 'logs.txt') {
        this.logFilePath = path.resolve(logFilePath);

        // Ensure the log file exists
        fs.writeFileSync(this.logFilePath, '', { flag: 'a' });
    }

    log(...messages) {
        this.writeLog('LOG', ...messages);
    }

    info(...messages) {
        this.writeLog('INFO', ...messages);
    }

    warn(...messages) {
        this.writeLog('WARN', ...messages);
    }

    error(...messages) {
        this.writeLog('ERROR', ...messages);
    }

    writeLog(level, ...messages) {
        try {
            for (const message of messages) {
                const timestamp = new Date().toISOString();
                const logMessage = `[${timestamp}] [${level}] ${message}`;

                // Write to console
                console.log(logMessage);

                // Append to log file
                fs.appendFileSync(this.logFilePath, logMessage + '\n', 'utf8');
            }
        } catch (e) {
            console.log(e);
        }
    }
}

exports.logger = new Logger();