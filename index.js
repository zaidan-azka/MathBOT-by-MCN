// Import required libraries
const { Client, GatewayIntentBits } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();

// Bot instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Open or create database 'quiz.db' file
const db = new sqlite3.Database('./quiz.db', (err) => {
    if (err) {
        console.error('Failed to open Database:', err.message);
    } else {
        console.log('Connect to SQLite');
    }
});

// Create poin table if not yet available
db.run(`
    CREATE TABLE IF NOT EXISTS points (
        user_id TEXT PRIMARY KEY,
        points INTEGER DEFAULT 0
    )
`);

// Set maximum points to get role
const TARGET_POINTS = 100;
const ROLE_NAME = "Math Master";
const QUIZ_CHANNEL_ID = 'CHANNEL-ID-FOR-BOT-SEND-QUESTION'; // change to bot channel will send questions
const QUIZ_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Function to select random math questions
function generateMathQuestion() {
    const questionTypes = ["addition", "subtraction", "multiplication", "division", "percentage", "distance", "fraction", "algebra", "matrix"];
    const type = questionTypes[Math.floor(Math.random() * questionTypes.length)];
    let question, answer;

    switch (type) {
        case "addition":
            const add1 = Math.floor(Math.random() * 100);
            const add2 = Math.floor(Math.random() * 100);
            question = `How much ${add1} + ${add2}?`;
            answer = add1 + add2;
            break;

        case "subtraction":
            const sub1 = Math.floor(Math.random() * 100);
            const sub2 = Math.floor(Math.random() * 100);
            question = `How much ${sub1} - ${sub2}?`;
            answer = sub1 - sub2;
            break;

        case "multiplication":
            const mul1 = Math.floor(Math.random() * 10);
            const mul2 = Math.floor(Math.random() * 10);
            question = `How much ${mul1} x ${mul2}?`;
            answer = mul1 * mul2;
            break;

        case "division":
            const div1 = Math.floor(Math.random() * 100) + 1;
            const div2 = Math.floor(Math.random() * 10) + 1;
            question = `How much ${div1} ÷ ${div2}? *rounded to 2 decimal places*`;
            answer = (div1 / div2).toFixed(2);
            break;

        case "percentage":
            const base = Math.floor(Math.random() * 100) + 1;
            const percent = Math.floor(Math.random() * 100);
            question = `How much ${percent}% from ${base}?`;
            answer = ((percent / 100) * base).toFixed(2);
            break;

        case "distance":
            const speed = Math.floor(Math.random() * 100) + 1;
            const time = Math.floor(Math.random() * 10) + 1;
            question = `If a person moves at a speed ${speed} m/s selama ${time} second, how many meters distance traveled?`;
            answer = speed * time;
            break;

        case "fraction":
            const num = Math.floor(Math.random() * 10) + 1;
            const denom = Math.floor(Math.random() * 10) + 1;
            question = `What is the result of ${num}/${denom} in decimal form? *rounded to 2 decimal places*`;
            answer = (num / denom).toFixed(2);
            break;

        case "algebra":
            const x = Math.floor(Math.random() * 10) + 1;
            const constTerm = Math.floor(Math.random() * 10);
            const coeff = Math.floor(Math.random() * 10) + 1;
            question = `Jika x = ${x}, what is the result of ${coeff}x + ${constTerm}?`;
            answer = coeff * x + constTerm;
            break;

        case "matrix":
            const a = Math.floor(Math.random() * 10);
            const b = Math.floor(Math.random() * 10);
            const c = Math.floor(Math.random() * 10);
            const d = Math.floor(Math.random() * 10);
            question = `Calculate the determinant matriks [[${a}, ${b}], [${c}, ${d}]]`;
            answer = (a * d) - (b * c);
            break;

        default:
            question = "Error: unable to generate questions.";
            answer = null;
    }

    return { question, answer };
}

// Function to send quiz questions automatically
function sendQuizQuestion() {
    const quiz = generateMathQuestion();
    const channel = client.channels.cache.get(QUIZ_CHANNEL_ID);

    if (!channel) {
        console.error(`Channel ID ${QUIZ_CHANNEL_ID} not found.`);
        return;
    }

    channel.send(quiz.question).then(() => {
        // Wait for the answer for 20 seconds before the question ends
        const filter = (response) => !response.author.bot && response.content === quiz.answer.toString();
        channel.awaitMessages({ filter, max: 1, time: 20000, errors: ['time'] })
            .then(collected => {
                const answerer = collected.first().author;
                channel.send(`Correct! ${answerer} get 10 points!`);

                // Add point to Databse
                db.run(`INSERT INTO points (user_id, points)
                        VALUES (?, 1)
                        ON CONFLICT(user_id)
                        DO UPDATE SET points = points + 1`,
                    [answerer.id],
                    async (err) => {
                        if (err) {
                            console.error('failed to add points:', err.message);
                            return;
                        }

                        // Check if points are sufficient to get a role
                        db.get(`SELECT points FROM points WHERE user_id = ?`, [answerer.id], async (err, row) => {
                            if (err) {
                                console.error('failed to take points:', err.message);
                                return;
                            }

                            if (row && row.points >= TARGET_POINTS) {
                                const guild = channel.guild;
                                const role = guild.roles.cache.find(role => role.name === ROLE_NAME);
                                const member = guild.members.cache.get(answerer.id);

                                if (role && member && !member.roles.cache.has(role.id)) {
                                    await member.roles.add(role);
                                    channel.send(`${answerer} has reached ${TARGET_POINTS} points and get role "${ROLE_NAME}"!`);
                                }
                            }
                        });
                    }
                );
            })
            .catch(() => {
                channel.send('Time has run out! wait 5 minutes then for the next question.');
            });
    });
}

// Event bot succesfully login
client.once('ready', () => {
    console.log(`Bot online sebagai ${client.user.tag}`);
    // Send exam every 5 minutes
    setInterval(sendQuizQuestion, QUIZ_INTERVAL);
});

// Login bot use token
client.login('YOUR-BOT-TOKEN'); //Enter your bot token on here
