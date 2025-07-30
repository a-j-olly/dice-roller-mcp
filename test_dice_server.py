from jsonrpcclient import request
import subprocess
import json
import time

# Start the server as a subprocess
server_process = subprocess.Popen(
    ["node", "build/src/index.js", "--stdio"],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True
)

# Give the server a moment to start up
time.sleep(5)

# Prepare a request
req = request("tools/call", {
    "name": "roll_dice",
    "arguments": {
        "dice_count": 3,
        "dice_sides": 6
    }
})

# Send to the server
print(f"Sending request: {req}")
server_process.stdin.write(json.dumps(req) + "\n")
server_process.stdin.flush()

# Read response (with timeout)
time.sleep(0.5)
response = server_process.stdout.readlines(5)

# Print the response
print("Response:", response)
print(json.dumps(json.loads(response), indent=2))

# Clean up
server_process.terminate()
