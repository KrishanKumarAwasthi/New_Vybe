import React, { useEffect } from 'react'
import { MdOutlineKeyboardBackspace } from "react-icons/md";
import { useNavigate } from 'react-router-dom';
import { GoSearch } from "react-icons/go";
import { useDispatch, useSelector } from 'react-redux';
import OnlineUser from '../components/OnlineUser';
import { setSelectedUser, setPrevChatUsers } from '../redux/messageSlice';
import dp from "../assets/dp.webp"
import axios from 'axios';
import { serverUrl } from '../App';
function Messages() {
    const navigate=useNavigate()
    const {userData}=useSelector(state=>state.user)
     const {onlineUsers, socket}=useSelector(state=>state.socket)
      const {prevChatUsers,selectedUsers}=useSelector(state=>state.message)
const dispatch=useDispatch()

useEffect(() => {
    socket?.on("newMessage", async () => {
        try {
            const result = await axios.get(`${serverUrl}/api/message/prevChats`, { withCredentials: true });
            dispatch(setPrevChatUsers(result.data));
        } catch (error) {
            console.log(error);
        }
    });
    return () => socket?.off("newMessage");
}, [socket, dispatch]);
  return (

    <div className='w-full min-h-[100vh] flex flex-col bg-black gap-[20px] p-[10px]'>
       <div className='w-full h-[80px]  flex items-center gap-[20px] px-[20px]'>

                      <MdOutlineKeyboardBackspace className='text-white cursor-pointer lg:hidden w-[25px]  h-[25px] ' onClick={() => navigate(`/`)} />
                      <h1 className='text-white text-[20px] font-semibold'>Messages</h1>
                  </div>

{userData.following?.some(user => onlineUsers?.includes(user._id)) && (
    <div className='w-full h-[80px] flex gap-[20px] justify-start items-center overflow-x-auto p-[20px] border-b-2 border-gray-800'>
        {userData.following?.map((user,index)=>(
            (onlineUsers?.includes(user._id)) && <OnlineUser key={index} user={user}/>
        ))}
    </div>
)}


        <div className='w-full h-full overflow-auto flex flex-col gap-[20px] px-[20px]'>
{prevChatUsers?.map((user,index)=>(
  <div className='text-white cursor-pointer w-full flex  items-center gap-[10px]' onClick={()=>{
dispatch(setSelectedUser(user))
navigate("/messageArea")
  }}>

{onlineUsers?.includes(user._id)? <OnlineUser user={user}/>: <div className='w-[50px] h-[50px] border-2 border-black rounded-full cursor-pointer overflow-hidden'>
          <img src={user.profileImage || dp} alt="" className='w-full object-cover'/>
      </div>
      }
      <div className='flex flex-col'>
<div className='text-white text-[18px] font-semibold'>{user.userName}</div>
{onlineUsers?.includes(user?._id) && <div className='text-blue-500 text-[15px] '>Active Now</div>}
</div>
  </div>
))}

          </div>          

    </div>
  )
}

export default Messages
