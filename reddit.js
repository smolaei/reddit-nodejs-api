var bcrypt = require('bcrypt');
var HASH_ROUNDS = 10;
var bodyParser = require('body-parser')

module.exports = function RedditAPI(conn) {
  return {
    createUser: function(user, callback) {

      // first we have to hash the password...
      bcrypt.hash(user.password, HASH_ROUNDS, function(err, hashedPassword) {
        if (err) {
          callback(err);
        }
        else {
          conn.query(
            'INSERT INTO users (username,password, createdAt) VALUES (?, ?, ?)', [user.username, hashedPassword, new Date()],
            function(err, result) {
              if (err) {
                /*
                There can be many reasons why a MySQL query could fail. While many of
                them are unknown, there's a particular error about unique usernames
                which we can be more explicit about!
                */
                if (err.code === 'ER_DUP_ENTRY') {
                  callback(new Error('A user with this username already exists'));
                }
                else {
                  callback(err);
                }
              }
              else {
                /*
                Here we are INSERTing data, so the only useful thing we get back
                is the ID of the newly inserted row. Let's use it to find the user
                and return it
                */
                conn.query(
                  'SELECT id, username, createdAt, updatedAt FROM users WHERE id = ?', [result.insertId],
                  function(err, result) {
                    if (err) {
                      callback(err);
                    }
                    else {
                      /*
                      Finally! Here's what we did so far:
                      1. Hash the user's password
                      2. Insert the user in the DB
                      3a. If the insert fails, report the error to the caller
                      3b. If the insert succeeds, re-fetch the user from the DB
                      4. If the re-fetch succeeds, return the object to the caller
                      */
                      callback(null, result[0]);
                    }
                  }
                );
              }
            }
          );
        }
      });
    },
    createPost: function(post, subredditId, callback) {
      conn.query(
        `INSERT INTO posts (userId, title, url, createdAt, subredditId) 
        VALUES (?, ?, ?, ?, ?)`, [post.userId, post.title, post.url, new Date(), subredditId],
        function(err, result) {
          if (err) {
            callback(err);
          }
          else {
            /*
            Post inserted successfully. Let's use the result.insertId to retrieve
            the post and send it to the caller!
            */
            conn.query(
              `SELECT id,title,url,userId, createdAt, updatedAt, subredditId 
               FROM posts 
               WHERE id = ?`, [result.insertId],
              function(err, result) {
                if (err) {
                  callback(err);
                }
                else {
                  callback(null, result[0]);
                }
              }
            );
          }
        }
      );
    },
 getAllPosts: function(options, sortingMethod, callback) {
      // In case we are called without an options parameter, shift all the parameters manually
      if (!callback) {
        callback = options;
        options = {};
      }
      var limit = options.numPerPage || 25; // if options.numPerPage is "falsy" then use 25
      var offset = (options.page || 0) * limit;
      if (sortingMethod === "newestRanking") {
        sortingMethod = 'newestRanking';
      }
      if (sortingMethod === "voteScore") {
        sortingMethod = 'voteScore';
      }
      if (sortingMethod === "controversialRanking") {
        sortingMethod = 'controversialRanking';
      }
      if (sortingMethod === "hotnessRanking") {
        sortingMethod = "SUM(v.vote)/(now() - p.createdAt)"
      }

      conn.query(`
        SELECT p.id,
          p.title AS postTitle, 
          p.url AS postURL, 
          p.userId AS postUserId, 
          p.createdAt AS newestRanking, 
          p.updatedAt AS postUpdatedAt, 
          u.id AS userId, 
          u.username, 
          u.createdAt AS userCreatedAt, 
          u.updatedAt AS userUpdatedAt,
          s.id AS subId,
          s.name,
          s.description AS des,
          s.createdAt AS subCreatedAt,
          s.updatedAt AS subUpdatedAt,
          SUM(v.vote) AS voteScore,
          (SUM(v.vote))*100000000/(now() - p.createdAt) as hottest,
          COUNT(*) AS totalVotes,
          COUNT(c.id) AS totalComments,
          SUM(IF(v.vote = 1, 1, 0)) AS numUpVotes,
          SUM(IF(v.vote = -1, 1, 0)) AS numDownVotes,
          CASE 
            WHEN SUM(IF(v.vote = 1, 1, 0)) < SUM(IF(v.vote = -1, 1,0)) 
               THEN COUNT(*) * SUM(IF(v.vote = -1, 1,0)) / SUM(IF(v.vote = 1, 1,0))
               ELSE COUNT(*) * SUM(IF(v.vote = 1, 1,0)) / SUM(IF(v.vote = -1, 1,0))
            END AS controversialRanking
        FROM posts p
          LEFT JOIN users u ON p.userId = u.id
          LEFT JOIN subreddit s ON p.subredditId = s.id
          LEFT JOIN votes v ON p.id = v.postId
          LEFT JOIN comments c ON c.postId = p.id
          GROUP by p.id
        ORDER BY ${sortingMethod} DESC LIMIT ? OFFSET ?`, [limit, offset],
        function(err, results) {
          if (err) {
            console.log(err);
            callback(err);
          }
          else {
            // console.log(results);
            var mappedResults = results.map(function(value) {
              return {
                post: {
                  id: value.id,
                  title: value.postTitle,
                  url: value.postURL,
                  createdAt: value.newestRanking,
                  updatedAt: value.postUpdatedAt,
                },
                user: {
                  userId: value.userId,
                  username: value.username,
                  createdAt: value.userCreatedAt,
                  updatedAt: value.userUpdatedAt,

                },
                subreddit: {
                  subredditId: value.subId,
                  Name: value.name,
                  description: value.des,
                  createdAt: value.subCreatedAt,
                  updatedAt: value.subUpdatedAt
                },
                votes: {
                  voteScore: value.voteScore,
                  numUpVotes: value.numUpVotes,
                  numDownVotes: value.numDownVotes,
                  totalVotes: value.totalVotes,
                  hotnessRanking: value.hottest,
                  controversialRanking: value.controversialRanking,
                }
              };
            });
            callback(null, mappedResults);
          }
        }
      );
    },
    getAllPostsForUser: function(userId, options, callback) {
      if (!callback) {
        callback = options;
        options = {};
      }
      var limit = options.numPerPage || 25; // if options.numPerPage is "falsy" then use 25
      var offset = (options.page || 0) * limit;

      conn.query(`
        SELECT *
        FROM posts
        JOIN users
        ON (users.id = posts.userId) where userId=?`, [userId, limit, offset],
        function(err, results) {
          if (err) {
            callback(err);
          }
          else {

            var formatedResults = results.map(function(value) {
              return {
                id: value.id,
                title: value.title,
                url: value.url,
                createdAt: value.createdAt,
                updatedAt: value.updatedAt,
              };
            });
            callback(null, formatedResults);
          }
        }
      );
    },
    getSinglePost: function(postId, callback) {
      conn.query(
        `SELECT id,title,url,userId, createdAt, updatedAt 
          FROM posts 
          WHERE posts.id = ?`, [postId],
        function(err, result) {
          if (err) {
            callback(err);
          }
          else {
            var formatedResults = result.map(function(value) {
              return {
                id: value.id,
                title: value.title,
                url: value.url,
                createdAt: value.createdAt,
                updatedAt: value.updatedAt,
              };
            });
            callback(null, formatedResults);
          }
        }
      );
    },
    createSubreddit: function(sub, callback) {
      if (!sub || !sub.name) {
        callback(new Error('name is mandatory'));
        return;
      }
      conn.query(
        `INSERT INTO subreddit (id, name, description, createdAt,updatedAt)
         VALUES (?, ?, ?, ?, ?)`, [sub.id, sub.name, sub.description, new Date(), new Date()],
        function(err, result) {
          if (err) {
            callback(err);
          }
          else {
            /*
            Post inserted successfully. Let's use the result.insertId to retrieve
            the post and send it to the caller!
            */
            conn.query(
              `SELECT id,title,url,userId, createdAt, updatedAt 
               FROM posts 
               WHERE id = ?`, [result.insertId],
              function(err, result) {
                if (err) {
                  callback(err);
                }
                else {
                  callback(null, result[0]);
                }
              }
            );
          }
        }
      );
    },
    getAllSubreddits: function(callback) {
      conn.query(`
      SELECT id,
          name,
          description,
          createdAt,
          updatedAt
        FROM subreddit
        ORDER BY createdAt DESC`, function(err, result) {
        if (err) {
          callback(err);
        }
        else {
          var formatedResults = result.map(function(ele) {
            return {
              id: ele.id,
              name: ele.name,
              description: ele.description,
              createdAt: ele.createdAt,
              updatedAt: ele.updatedAt
            };
          });
          callback(null, formatedResults);
        }
      });
    },
    createOrUpdateVote: function(vote, callback) {
      if (vote.vote === -1 || vote.vote === 0 || vote.vote === 1) {
        console.log("You have voted " + vote.vote + " for this post");
        conn.query(
          `INSERT INTO votes (postId, userId, vote, createdAt)
          VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE vote = ?, updatedAt = ?`, [vote.postId, vote.userId, vote.vote, new Date(), vote.vote, new Date()],
          function(err, result) {
            if (err) {
              callback(err);
            }
            else {
              conn.query(
                `SELECT * FROM votes`,
                function(err, result) {
                  if (err) {
                    callback(err);
                  }
                  else {
                    callback(null, result);
                  }
                }
              );
            }
          });
      }
      else {
        callback('Vote has to be equal to 0,1 or -1');
      }
    },
    createComment: function(comment, callback) {
      if (!comment.userId || !comment.postId) {
        callback(null, new Error('userId and postId required'));
        return;
      }
      if (!comment.parentId) {
        comment.parentId = null;
      }
      conn.query(
        `INSERT INTO comments (text, userId, postId, parentId, createdAt) 
        VALUES (?, ?, ?, ?, ?)`, [comment.text, comment.userId, comment.postId, comment.parentId, new Date()],
        function(err, result) {
          if (err) {
            callback(err);
          }
          else {
            /*
            comment inserted successfully. Let's use the result.insertId to retrieve
            the post and send it to the caller!
            */
            conn.query(
              `SELECT id,text,userId, createdAt, parentId 
               FROM comments 
               WHERE id = ?`, [result.insertId],
              function(err, result) {
                if (err) {
                  callback(err);
                }
                else {
                  callback(null, result[0]);
                }
              }
            );
          }
        }
      );
    },
    getCommentsForPost: function(postId, callback) {
      conn.query(
        `SELECT c.id,
          c.text, 
          c.createdAt, 
          c.updatedAt,
          r.id AS replyId,
          r.text AS replyText,
          r.createdAt AS replyCreatedAt, 
          r.updatedAt AS replyUpdatedAt,
          r2.id AS reply2Id,
          r2.text AS reply2Text,
          r2.createdAt AS reply2CreatedAt,
          r2.updatedAt AS reply2Updated,
          COUNT(c.id) AS totalComments,
          c.parentId,
          u.username 
        FROM comments c
        LEFT JOIN comments r ON c.id = r.parentId
        LEFT JOIN comments r2 ON r.id = r2.parentId
        JOIN users u ON c.userId = u.id
          WHERE c.postId = ? AND c.parentId IS NULL
          ORDER by c.createdAt`, [postId],
        function(err, result) {

          if (err) {
            callback(err);
          }
          else {
            var finalCommentArray = [{
              totalComments: result[0].totalComments
            }];
            var commentObj = {};


            result.forEach(function(comment) {
              if (!commentObj[comment.id]) {
                commentObj[comment.id] = {
                  id: comment.id,
                  text: comment.text,
                  createdAt: comment.createdAt,
                  updatedAt: comment.updatedAt,
                  replies: []
                };
                finalCommentArray.push(commentObj[comment.id]);
              }
              if (!commentObj[comment.replyId] && comment.replyId) {
                commentObj[comment.replyId] = {
                  id: comment.replyId,
                  text: comment.replyText,
                  createdAt: comment.replyCreatedAt,
                  updatedAt: comment.replyUpdatedAt,
                  replies: []
                };
                commentObj[comment.id].replies.push(commentObj[comment.replyId]);
              }
              if (comment.reply2Id) {
                var lastReply = {
                  id: comment.reply2Id,
                  text: comment.reply2Text,
                  createdAt: comment.reply2CreatedAt,
                  updatedAt: comment.reply2UpdatedAt,
                };
                commentObj[comment.replyId].replies.push(lastReply);
              }
            });
            console.log(finalCommentArray);
            console.log(result[0].totalComments);
            callback(null, finalCommentArray);
          }
        }
      );
    },
    getTotalCommentsForPost: function(postId, callback) {
      conn.query(`
        SELECT 
        COUNT(*) as totalComments
        FROM comments 
        JOIN users ON comments.userId = users.id
          WHERE comments.postId = ?`, [postId],
        function(err, totalComments) {
          if (err) {
            console.log(err);
            callback(err);
          }
          else {
            console.log(totalComments[0]);
            callback(null, totalComments[0]);
          }
        }
      );
    },
  };
};
