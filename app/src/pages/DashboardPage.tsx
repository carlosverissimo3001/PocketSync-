import { useAuthContext } from "@/contexts/AuthContext";
import { List } from "@/types/list.types";
import { ListDashboard } from "@/components/list/ListDashboard";
import { v4 as uuidv4 } from 'uuid';
import { useEffect, useState } from 'react';
import { NewListCard } from "@/components/list/NewListCard";
import { fetchListsWithItems, createList, updateList, deleteList } from "@/db/db-utils";
import { ListCard } from "@/components/list/ListCard";
 

export const DashboardPage = () => {
  const { user } = useAuthContext();
  const [lists, setLists] = useState<List[]>();

  useEffect(() => {
    const fetchData = async () => {
      const data = await fetchListsWithItems();
      setLists(data); 
    };
    fetchData();
  }, []);

  const createListHandler = async (listName: string) => {
    const newList: List = {
      id: uuidv4(),
      name: listName,
      createdAt: new Date(),
      ownerId: user?.id ?? "",
      items: [],
    }

    await createList(newList);

    const updatedLists = await fetchListsWithItems();
    setLists(updatedLists);
  }

  const updateListHandler = async (list: List) => {
    await updateList(list);

    const updatedLists = await fetchListsWithItems();
    setLists(updatedLists);
  }

  const deleteListHandler = async (list: List) => {
    await deleteList(list.id);

    const updatedLists = await fetchListsWithItems();
    setLists(updatedLists);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">          
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white sm:text-5xl">
            Welcome back, <span className="text-indigo-600 dark:text-indigo-400">{user?.username}</span>
          </h1>
        </div>

        <div className="break-inside-avoid mb-6 hover:scale-102 transition-transform flex justify-center">
          <NewListCard onAdd={createListHandler} />
        </div>

        {lists?.length ? (
          <div className="mt-6">
            <div className="columns-1 md:columns-2 lg:columns-3 gap-6">            
            {lists?.map((list) => (
                <div key={list.id} className="break-inside-avoid mb-6 hover:scale-102 transition-transform">
                    <ListCard 
                        list={list} 
                        updateList={updateListHandler}
                        handleDelete={deleteListHandler}
                        isFromSingleView={false}
                    />
                </div>
            ))}
        </div>
          </div>
        ) : (
          <div className="mt-12 max-w-lg mx-auto text-center">
            <div className="rounded-lg bg-white/5 p-8 shadow-lg ring-1 ring-gray-900/10 dark:ring-white/10">
              <div className="flex justify-center">
                <svg className="h-24 w-24 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900 dark:text-white">No lists yet</h3>
              <p className="mt-2 text-gray-500 dark:text-gray-400">Get started by creating your first list using the button above</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
