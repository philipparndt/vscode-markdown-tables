let fs = require('fs')

let version = require('../../package.json').version

try {
    let data = fs.readFileSync('../../CHANGELOG.md', 'utf8')

    let found = false
    let changes = []

    for (line of data.split(/\r\n|\n/)) {
        if (line.trim().startsWith("# ")) {
            found = false;
        }

        if (found) {
            changes.push(line)
        }

        if (line.trim().startsWith(`# ${version}`)) {
            found = true
        }
    }
    console.log(changes.join("\n").trim())
} catch (e) {
    console.log('Error:', e.stack);
    process.exit(1)
}
