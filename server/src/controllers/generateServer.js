import { createRepo, createFile } from './githubController.js';
import { extend } from './../utils/utils';
import { buildAllFiles } from '../../build/controllers/expressBuild/buildFiles.js';

export function generate(request, response) {
  request.session.files = {
    serverJS: {
      type: 'main',
      name: 'server',
    },
  };

  request.session.files.npm = {
    type: 'packageJSON',
    name: 'package.json',
  };

  if (request.body.data.routers.length) {
    request.session.files.routers = {
      type: 'router',
      name: request.body.data.routers,
    };
  }

  // copy cookies to body.data
  request.body.data.cookies = {};
  // TODO: remove userInfo parameter
  extend(request.body.data.cookies, request.cookies);
  // EMAIL BUG: fix '@'
  // copy appName to routers obj
  request.body.data.routers.forEach(router => {
    router.appName = request.body.data.appName;
    router.github = request.body.data.github;
  });

  const builtFiles = buildAllFiles(request, response);
  // Send these files to github!
  // Make repo (naming handled in controller)
  createRepo(request.body.data).then(() => {
    // separate calls for every file
    // builtFiles will always only be [serverFile, package.json, [routerFiles]]
    createFile(builtFiles[0], request.body.data, request.body.data.cookies, 'server.js').then(() => {
      // successfully created server file
      // create package.json here:
      createFile(builtFiles[1], request.body.data, request.body.data.cookies, 'package.json').then(() => {
        // successfully created package.json
        // create router files here:
        if (builtFiles[2]) {
          const asyncRun = (filesArr, ind) => {
            ind = ind || 0;
            if (ind !== filesArr.length) {
              createFile(filesArr[ind], request.body.data.routers[ind], request.body.data.cookies).then(() => {
                asyncRun(filesArr, ind + 1);
              }).catch((routerErr) => {
                console.log(`Problem creating router files on your GitHub: Error: ${routerErr}`);
                response.status(400).send(`Problem creating router files on your GitHub: Error: ${routerErr}`);
              });
            } else {
              return response.status(201).send({
                user: request.cookies.user,
                repoName: request.body.data.github.repoName,
              });
            }
          };
          asyncRun(builtFiles[2], 0);
        } else {
          return response.status(201).send({
            user: request.cookies.user,
            repoName: request.body.data.github.repoName,
          });
        }
      }).catch(packageError => {
        console.log(`Error creating package.json: ${packageError}`);
        response.status(400).send(`Error creating package.json: ${packageError}`);
      });
    }).catch(serverError => {
      console.log(`Error creating server or generating router files: ${serverError}`);
      response.status(400).send(`Error creating server: ${serverError}`);
    });
  }).catch((error) => {
    console.log(`Problem creating repo on your GitHub: Error: ${error}`);
    response.status(400).send(`Problem creating repo on your GitHub: Error: ${error}`);
  });
}

export function generateFiles(request, response) {
  const reqData = request.body.data;
  if (!reqData) {
    return response.status(400).send(new Error('No server type on request'));
  }
  // generate express server
  return generate(request, response);
}
