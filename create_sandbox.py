from daytona import Daytona, CreateSandboxFromImageParams, Resources

daytona = Daytona()

sandbox = daytona.create(CreateSandboxFromImageParams(
    image="ubuntu:22.04",
    resources=Resources(cpu=4, memory=8, disk=10),
    domain_allow_list="bin.equinox.io,update.equinox.io,ngrok.com,*.ngrok.com,*.ngrok-agent.com,*.ngrok-free.app,archive.ubuntu.com,security.ubuntu.com,dl.ngrok.com,*.github.com,github.com,registry.npmjs.org,*.npmjs.org,deb.nodesource.com",
))

print("Новый sandbox ID:", sandbox.id)
